// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

// github@mevdragon
contract OtterPadFund is ReentrancyGuard {
    struct Purchase {
        uint256 paymentAmount;      // Total amount paid by user in payment token wei
        uint256 contributionAmount; // Amount after otterpad fee and upfront rake in payment token wei
        uint256 tokenAmount;       // Calculated token amount at purchase time in sale token wei
        address purchaser;
        bool isRefunded;
        bool isRedeemed;
        uint256 purchaseBlock;
    }

    IERC20Metadata public immutable saleToken;
    string public saleTokenSymbol;
    uint8 public saleTokenDecimals;

    IERC20Metadata public immutable paymentToken;
    string public paymentTokenSymbol;
    uint8 public paymentTokenDecimals;

    IUniswapV2Router02 public immutable uniswapRouter;
    IUniswapV2Factory public immutable uniswapFactory;
    
    // Prices are stored in payment token wei per 1e18 sale tokens
    uint256 public immutable startPrice;
    uint256 public immutable endPrice;
    uint256 public immutable targetLiquidity;  // In payment token wei
    
    uint256 public constant OTTERPAD_FEE_BPS = 200;  // 2% in basis points
    uint256 public immutable upfrontRakeBPS;         // Basis points taken upfront (includes otterpad fee)
    uint256 public immutable escrowRakeBPS;          // Basis points held in escrow
    
    
    address public immutable foundersWallet;
    address public constant OTTERPAD_DAO = 0x6c83e86e05697C995d718C1cfA3F9045A38C7cd4;
    address public immutable lockLPTokenWallet;
    address public uniswapPool;
    
    uint256 public orderCounter;
    bool public isDeployedToUniswap;
    bool public targetReached;
    
    // Running totals (all in their respective token wei)
    uint256 public totalTokensAllocated;  // In sale token wei
    uint256 public totalActiveContributions; // In payment token wei
    uint256 public totalPaymentsIn;  // In payment token wei

    string public title;
    string public richInfoUrl;
    
    mapping(uint256 => Purchase) public purchases;
    mapping(address => uint256[]) public userOrderIndices;
    
    event TokensPurchased(
        address indexed purchaser,
        uint256 paymentAmount, 
        uint256 contributionAmount,
        uint256 tokenAmount,
        uint256 indexed orderIndex,
        uint256 netActiveContributions,
        uint256 timestamp
    );
    event TokensRedeemed(
        address indexed purchaser,
        uint256 tokenAmount,
        uint256 indexed orderIndex
    );
    event Refunded(
        address indexed purchaser, 
        uint256 contributionAmount, 
        uint256 indexed orderIndex,
        uint256 netActiveContributions,
        uint256 timestamp
    );
    event DeployedToUniswap(address pair, uint256 liquidity);
    event EscrowReleased(uint256 amount, address foundersWallet);
    event PaymentReceived(
        address indexed purchaser,
        uint256 totalAmount,
        uint256 otterpadFee,
        uint256 upfrontAmount,
        uint256 escrowAmount,
        uint256 contributionAmount
    );
    
    constructor(
        string memory _title,
        string memory _richInfoUrl,
        address _saleToken,
        address _paymentToken,
        address _uniswapRouter,
        address _uniswapFactory,
        uint256 _startPrice,
        uint256 _endPrice,
        uint256 _targetLiquidity,
        uint256 _upfrontRakeBPS,
        uint256 _escrowRakeBPS,
        address _foundersWallet,
        address _lockLPTokenWallet
    ) {
        require(bytes(_title).length > 0, "Invalid title");
        require(_startPrice > 0 && _endPrice > 0 && _endPrice > _startPrice, "Invalid prices");
        require(_targetLiquidity > 0, "Invalid target funding");
        require(_upfrontRakeBPS >= OTTERPAD_FEE_BPS, "Upfront rake must be >= OtterPad fee");
        require(_upfrontRakeBPS + _escrowRakeBPS <= 7000, "Combined rake 70% exceeded");
        require(_foundersWallet != address(0), "Invalid founders wallet");
        require(_saleToken != address(0) && _paymentToken != address(0), "Invalid token addresses");
        require(_saleToken != _paymentToken, "Tokens must be different");
        require(_uniswapRouter != address(0) && _uniswapFactory != address(0), "Invalid Uniswap addresses");
        require(10000 - upfrontRakeBPS - escrowRakeBPS > 0, "Invalid rake parameters");
        
        title = _title;
        richInfoUrl = _richInfoUrl;
        saleToken = IERC20Metadata(_saleToken);
        paymentToken = IERC20Metadata(_paymentToken);
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        uniswapFactory = IUniswapV2Factory(_uniswapFactory);
        
        saleTokenDecimals = IERC20Metadata(_saleToken).decimals();
        paymentTokenDecimals = IERC20Metadata(_paymentToken).decimals();
        saleTokenSymbol = IERC20Metadata(_saleToken).symbol();
        paymentTokenSymbol = IERC20Metadata(_paymentToken).symbol();
        lockLPTokenWallet = _lockLPTokenWallet;
        
        // Prices are in payment token wei per 1e18 sale tokens
        startPrice = _startPrice;
        endPrice = _endPrice;
        targetLiquidity = _targetLiquidity;
        upfrontRakeBPS = _upfrontRakeBPS;
        escrowRakeBPS = _escrowRakeBPS;
        foundersWallet = _foundersWallet;
    }

    function getMinimumPurchase() public view returns (uint256) {
        return targetLiquidity / 1000000;
    }

    function getSaleTokenBalance() external view returns (uint256) {
        return saleToken.balanceOf(address(this));
    }

    function getPaymentTokenBalance() external view returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }

    function getEscrowedAmount() public view returns (uint256) {
        uint256 netContributionBPS = 10000 - upfrontRakeBPS - escrowRakeBPS;
        uint256 grossAmount = (totalActiveContributions * 10000) / netContributionBPS;
        return (grossAmount * escrowRakeBPS) / 10000;
    }
    
    function getSlope () public view returns (uint256) {
        uint256 totalCashInflows = targetLiquidity * 10000 / (10000 - upfrontRakeBPS - escrowRakeBPS);
        uint256 avgPrice = ((startPrice + endPrice) / 2);
        uint256 proratedTokensForSale = totalCashInflows * (10**paymentTokenDecimals) / avgPrice;
        uint256 salesTokensForSale = proratedTokensForSale * (10**saleTokenDecimals) / 10**paymentTokenDecimals;
        return (endPrice - startPrice) * (10**saleTokenDecimals) / salesTokensForSale;
    }
    
    function getCurrentPrice() public view returns (uint256) {
        return startPrice + (totalActiveContributions * getSlope()/(10**paymentTokenDecimals));
    }

    function _calculateTokensReceived(uint256 paymentAmount) private view returns (uint256) {
        // Given PAY tokens, how many X SALE tokens are received?
        // m = slope
        // b = startPrice
        // x = sale tokens received
        // PAY = input payment amount
        // -----------------------------
        // PAY = ∫(0 to X) (mx + b)dx 
        // PAY = (m/2)X² + bX
        // (m/2)X² + bX - PAY = 0
        // X = (-b ± √(b^2 + 4((m/2))(PAY))) / (2(m/2))
        // X = (-b + √(b^2 + 4((m/2))(PAY))) / (2(m/2))
        uint256 b = startPrice;
        int256 m = int256(getSlope());
        int256 saleTokensReceived = (-int256(b) + int256(Math.sqrt(
            uint256(int256(b)**2 + (4*((m)/2)*int256(paymentAmount)))
        ))) * int256(10**saleTokenDecimals) / (2*(m/2));
        return uint256(saleTokensReceived);
    }
    
    function calculateTokensReceived(uint256 paymentAmount) public view returns (uint256) {
        // Calculate contribution amount after fees (in payment token wei)
        uint256 otterpadFee = (paymentAmount * OTTERPAD_FEE_BPS) / 10000;
        uint256 upfrontAmount = (paymentAmount * upfrontRakeBPS) / 10000 - otterpadFee;
        uint256 escrowAmount = (paymentAmount * escrowRakeBPS) / 10000;
        uint256 contributionAmount = paymentAmount - upfrontAmount - escrowAmount - otterpadFee;
        require(totalActiveContributions + contributionAmount <= targetLiquidity, "Exceeds target");
        uint256 netCashInflows = totalActiveContributions * 10000 / (10000 - upfrontRakeBPS - escrowRakeBPS);
        uint256 salesTokensIssuedThusFar = _calculateTokensReceived(netCashInflows);
        uint256 salesTokensIssuedAfterThisPurchase = _calculateTokensReceived(netCashInflows + paymentAmount);
        uint256 netNewSalesTokensIssued = salesTokensIssuedAfterThisPurchase - salesTokensIssuedThusFar;
        return netNewSalesTokensIssued;
    }
    
    function buy(uint256 paymentAmount) external nonReentrant {
        require(!isDeployedToUniswap, "Sale completed");
        require(paymentAmount >= getMinimumPurchase(), "Below minimum purchase");
        
        // Calculate fees and amounts (all in payment token wei)
        uint256 otterpadFee = (paymentAmount * OTTERPAD_FEE_BPS) / 10000;
        uint256 upfrontAmount = (paymentAmount * upfrontRakeBPS) / 10000 - otterpadFee;
        uint256 escrowAmount = (paymentAmount * escrowRakeBPS) / 10000;
        uint256 contributionAmount = paymentAmount - otterpadFee - upfrontAmount - escrowAmount;
        
        require(totalActiveContributions + contributionAmount <= targetLiquidity, "Exceeds target");
        
        // Calculate tokens based on the FULL payment amount
        uint256 tokenAmount = calculateTokensReceived(paymentAmount);
        
        require(
            paymentToken.transferFrom(msg.sender, address(this), paymentAmount),
            "Payment transfer failed"
        );
        
        emit PaymentReceived(
            msg.sender,
            paymentAmount,
            otterpadFee,
            upfrontAmount,
            escrowAmount,
            contributionAmount
        );
        
        require(paymentToken.transfer(OTTERPAD_DAO, otterpadFee), "Fee transfer failed");
        require(paymentToken.transfer(foundersWallet, upfrontAmount), "Upfront transfer failed");

        uint256 orderIndex = orderCounter;
        orderCounter++;
        
        purchases[orderIndex] = Purchase({
            paymentAmount: paymentAmount,
            contributionAmount: contributionAmount,
            tokenAmount: tokenAmount,
            purchaser: msg.sender,
            isRefunded: false,
            isRedeemed: false,
            purchaseBlock: block.number
        });
        
        userOrderIndices[msg.sender].push(orderIndex);
        
        totalTokensAllocated += tokenAmount;
        totalActiveContributions += contributionAmount;
        totalPaymentsIn += paymentAmount;
        
        emit TokensPurchased(msg.sender, paymentAmount, contributionAmount, tokenAmount, orderIndex, totalActiveContributions, block.timestamp);
        
        if (totalActiveContributions >= targetLiquidity) {
            targetReached = true;
        }
    }

    function redeem(uint256 orderIndex) external nonReentrant {
        require(targetReached, "Target not reached yet");
        require(isDeployedToUniswap, "Not yet deployed to DEX");
        Purchase storage purchase = purchases[orderIndex];
        require(purchase.purchaser == msg.sender, "Not the purchaser");
        require(!purchase.isRefunded, "Order was refunded");
        require(!purchase.isRedeemed, "Already redeemed");
        
        require(purchase.tokenAmount > 0, "No tokens to redeem");
        
        purchase.isRedeemed = true;
        require(saleToken.transfer(msg.sender, purchase.tokenAmount), "Token transfer failed");
        
        emit TokensRedeemed(msg.sender, purchase.tokenAmount, orderIndex);
    }

    function refund(uint256 orderIndex) external nonReentrant {
        require(!isDeployedToUniswap, "Sale completed");
        Purchase storage purchase = purchases[orderIndex];
        require(purchase.purchaser == msg.sender, "Not the purchaser");
        require(!purchase.isRefunded, "Already refunded");
        require(!purchase.isRedeemed, "Already redeemed");
        
        purchase.isRefunded = true;
        
        totalTokensAllocated -= purchase.tokenAmount;
        totalActiveContributions -= purchase.contributionAmount;
        
        require(paymentToken.transfer(msg.sender, purchase.contributionAmount), "Refund failed");
        
        emit Refunded(msg.sender, purchase.contributionAmount, orderIndex, totalActiveContributions, block.timestamp);
    }

    function hasSufficientSaleTokens() external view returns (bool) {
        return saleToken.balanceOf(address(this)) >= checkSaleTokensRequired();
    }

    function _hasSufficientSaleTokens() internal view returns (bool) {
        return saleToken.balanceOf(address(this)) >= checkSaleTokensRequired();
    }
    
    function deployToUniswap() external returns (address pool) {
        require(targetReached, "Target not reached");
        require(!isDeployedToUniswap, "Already deployed");
        
        uint256 escrowAmount = getEscrowedAmount();
        
        require(_hasSufficientSaleTokens(), "Insufficient sale tokens");
        
        // Calculate liquidity tokens with proper decimal handling
        uint256 saleTokenBase = 10 ** saleTokenDecimals;
        uint256 paymentTokenBase = 10 ** paymentTokenDecimals;
        
        // Calculate complementary sale tokens for liquidity
        uint256 complimentarySalesTokensLiquidity = (targetLiquidity * saleTokenBase) / endPrice;
        
        require(saleToken.balanceOf(address(this)) >= complimentarySalesTokensLiquidity, "Insufficient sale tokens");
        require(paymentToken.balanceOf(address(this)) >= targetLiquidity + escrowAmount, 
            "Insufficient payment tokens");
        
        require(saleToken.approve(address(uniswapRouter), complimentarySalesTokensLiquidity), "Token approve failed");
        require(paymentToken.approve(address(uniswapRouter), targetLiquidity), "Payment approve failed");
        
        (uint256 amountA, uint256 amountB, uint256 liquidity) = uniswapRouter.addLiquidity(
            address(saleToken),
            address(paymentToken),
            complimentarySalesTokensLiquidity, 
            targetLiquidity,
            complimentarySalesTokensLiquidity,
            targetLiquidity,
            lockLPTokenWallet,
            block.timestamp + 2 minutes
        );
        
        if (escrowAmount > 0) {
            require(paymentToken.transfer(foundersWallet, escrowAmount), "Escrow release failed");
            emit EscrowReleased(escrowAmount, foundersWallet);
        }
        
        isDeployedToUniswap = true;

        pool = uniswapFactory.getPair(address(saleToken), address(paymentToken));
        uniswapPool = pool;
        
        emit DeployedToUniswap(
            pool,
            liquidity
        );

        return pool;
    }
    
    function getAllocation(address user) external view returns (uint256 totalTokens) {
        uint256[] memory orderIndices = userOrderIndices[user];
        
        for (uint256 i = 0; i < orderIndices.length; i++) {
            Purchase memory purchase = purchases[orderIndices[i]];
            if (!purchase.isRefunded) {
                totalTokens += purchase.tokenAmount;
            }
        }
        
        return totalTokens;
    }
    
    function getUserOrderIndices(address user) external view returns (uint256[] memory) {
        return userOrderIndices[user];
    }

    function recoverStuckTokens(
        address tokenAddress,
        uint256 amount
    ) external nonReentrant {
        require(msg.sender == foundersWallet, "Only founders can recover");
        require(isDeployedToUniswap, "Not yet deployed to Uniswap");
        require(tokenAddress != address(saleToken), "Cannot recover sale token");
        
        IERC20 token = IERC20(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(balance >= amount, "Insufficient balance");
        
        require(token.transfer(foundersWallet, amount), "Token recovery failed");
    }

    function checkSaleTokensRequired() public view returns (uint256) {
        
        // Calculate tokens needed for liquidity provision (at end price)
        uint256 proratedLiquidity = (targetLiquidity * 10 ** paymentTokenDecimals) / endPrice;
        uint256 salesTokensForLiquidity = proratedLiquidity * (10**saleTokenDecimals) / 10**paymentTokenDecimals;
        
        // Calculate tokens needed for buyers to receive
        uint256 totalCashInflows = targetLiquidity * 10000 / (10000 - upfrontRakeBPS - escrowRakeBPS);
        uint256 avgPrice = ((startPrice + endPrice) / 2);
        uint256 proratedTokensForSale = totalCashInflows * (10**paymentTokenDecimals) / avgPrice;
        uint256 salesTokensForSale = proratedTokensForSale * (10**saleTokenDecimals) / 10**paymentTokenDecimals;
        
        // Return total tokens needed (both liquidity and sale amounts)
        return salesTokensForLiquidity + salesTokensForSale;
    }
}