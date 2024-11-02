// OtterPadFund.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract OtterPadFund is ReentrancyGuard {
    struct Purchase {
        uint256 paymentAmount;      // Total amount paid by user
        uint256 contributionAmount; // Amount after otterpad fee and upfront rake
        uint256 tokenAmount;       // Calculated token amount at purchase time
        address purchaser;
        bool isRefunded;
        bool isRedeemed;
        uint256 purchaseBlock;
    }

    IERC20Metadata public immutable saleToken;
    IERC20Metadata public immutable paymentToken;
    IUniswapV2Router02 public immutable uniswapRouter;
    IUniswapV2Factory public immutable uniswapFactory;
    
    uint256 public immutable startPrice;
    uint256 public immutable endPrice;
    uint256 public immutable targetLiquidity;
    
    uint256 public constant OTTERPAD_FEE_BPS = 100;  // 1% in basis points
    uint256 public immutable upfrontRakeBPS;         // Basis points taken upfront (includes otterpad fee)
    uint256 public immutable escrowRakeBPS;          // Basis points held in escrow
    
    uint8 private immutable saleTokenDecimals;
    uint8 private immutable paymentTokenDecimals;
    
    address public immutable foundersWallet;
    address public constant OTTERPAD_DAO = 0x6c83e86e05697C995d718C1cfA3F9045A38C7cd4;
    
    uint256 public orderCounter;
    bool public isDeployedToUniswap;
    bool public targetReached;
    
    // Running totals
    uint256 public totalTokensAllocated;
    uint256 public totalActiveContributions;
    uint256 public totalPaymentsIn;

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
        address _foundersWallet
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
        
        title = _title;
        richInfoUrl = _richInfoUrl;
        saleToken = IERC20Metadata(_saleToken);
        paymentToken = IERC20Metadata(_paymentToken);
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        uniswapFactory = IUniswapV2Factory(_uniswapFactory);
        
        saleTokenDecimals = IERC20Metadata(_saleToken).decimals();
        paymentTokenDecimals = IERC20Metadata(_paymentToken).decimals();
        
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
        return (totalPaymentsIn * escrowRakeBPS) / 10000;
    }
    
    function getCurrentPrice() public view returns (uint256) {
        if (totalActiveContributions >= targetLiquidity) return endPrice;
        return startPrice + ((endPrice - startPrice) * totalActiveContributions / targetLiquidity);
    }
    
    function normalizeDecimals(uint256 amount, uint8 fromDecimals, uint8 toDecimals) internal pure returns (uint256) {
        if (fromDecimals == toDecimals) return amount;
        if (fromDecimals < toDecimals) return amount * 10**(toDecimals - fromDecimals);
        return amount / 10**(fromDecimals - toDecimals);
    }
    
    function calculateTokensReceived(uint256 paymentAmount) public view returns (uint256) {
        // Calculate contribution amount after fees
        uint256 otterpadFee = (paymentAmount * OTTERPAD_FEE_BPS) / 10000;
        uint256 upfrontAmount = (paymentAmount * upfrontRakeBPS) / 10000 - otterpadFee;
        uint256 escrowAmount = (paymentAmount * escrowRakeBPS) / 10000;
        uint256 contributionAmount = paymentAmount - upfrontAmount - escrowAmount - otterpadFee;
        
        require(totalActiveContributions + contributionAmount <= targetLiquidity, "Exceeds target");
        
        // Integration using average price method for linear price curve
        uint256 priceAtStart = getCurrentPrice();
        uint256 priceAtEnd = startPrice + ((endPrice - startPrice) * (totalActiveContributions + contributionAmount) / targetLiquidity);
        uint256 averagePrice = (priceAtStart + priceAtEnd) / 2;
        
        // Convert the ORIGINAL payment amount to sale token decimals
        uint256 normalizedPayment = normalizeDecimals(
            paymentAmount,
            paymentTokenDecimals,
            saleTokenDecimals
        );
        
        return (normalizedPayment * (10**saleTokenDecimals)) / averagePrice;
    }
    
    function buy(uint256 paymentAmount) external nonReentrant {
        require(!isDeployedToUniswap, "Sale completed");
        require(!targetReached, "Target already reached");
        require(paymentAmount >= getMinimumPurchase(), "Below minimum purchase");
        
        // Calculate fees and amounts
        uint256 otterpadFee = (paymentAmount * OTTERPAD_FEE_BPS) / 10000;
        uint256 upfrontAmount = (paymentAmount * upfrontRakeBPS) / 10000 - otterpadFee;
        uint256 escrowAmount = (paymentAmount * escrowRakeBPS) / 10000;
        uint256 contributionAmount = paymentAmount - otterpadFee - upfrontAmount - escrowAmount;
        
        require(totalActiveContributions + contributionAmount <= targetLiquidity, "Exceeds target");
        
        // Calculate tokens based on the FULL payment amount, not the contribution amount
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
        require(!targetReached, "Target already reached");
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
    
    function deployToUniswap() external {
        require(msg.sender == foundersWallet, "Only founders can deploy");
        require(targetReached, "Target not reached");
        require(!isDeployedToUniswap, "Already deployed");
        
        uint256 escrowAmount = getEscrowedAmount();
        uint256 liquidityPaymentAmount = totalActiveContributions - escrowAmount;
        
        require(_hasSufficientSaleTokens(), "Insufficient sale tokens");
        
        require(saleToken.balanceOf(address(this)) >= totalTokensAllocated, "Insufficient sale tokens");
        require(paymentToken.balanceOf(address(this)) >= totalActiveContributions, 
            "Insufficient payment tokens");
        
        require(saleToken.approve(address(uniswapRouter), totalTokensAllocated), "Token approve failed");
        require(paymentToken.approve(address(uniswapRouter), liquidityPaymentAmount), "Payment approve failed");
        
        (uint256 amountA, uint256 amountB, uint256 liquidity) = uniswapRouter.addLiquidity(
            address(saleToken),
            address(paymentToken),
            totalTokensAllocated,
            liquidityPaymentAmount,
            totalTokensAllocated,
            liquidityPaymentAmount,
            address(this),
            block.timestamp + 2 minutes
        );
        
        if (escrowAmount > 0) {
            require(paymentToken.transfer(foundersWallet, escrowAmount), "Escrow release failed");
            emit EscrowReleased(escrowAmount, foundersWallet);
        }
        
        isDeployedToUniswap = true;
        
        emit DeployedToUniswap(
            uniswapFactory.getPair(address(saleToken), address(paymentToken)),
            liquidity
        );
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
        // First calculate the actual contribution amount after rake
        uint256 netContributionBPS = 10000 - upfrontRakeBPS - escrowRakeBPS;
        uint256 actualContribution = (targetLiquidity * 10000) / netContributionBPS;
        
        // Convert prices to have same decimals as payment token
        uint256 normalizedStartPrice = normalizeDecimals(
            startPrice,
            paymentTokenDecimals,
            saleTokenDecimals
        );
        uint256 normalizedEndPrice = normalizeDecimals(
            endPrice,
            paymentTokenDecimals,
            saleTokenDecimals
        );
        
        // Calculate tokens for sale using the average price method
        uint256 averagePrice = (normalizedStartPrice + normalizedEndPrice) / 2;
        uint256 tokensForSale = (actualContribution * (10**saleTokenDecimals)) / averagePrice;
        
        // Calculate tokens needed for DEX liquidity at end price
        uint256 liquidityTokens = (targetLiquidity * (10**saleTokenDecimals)) / normalizedEndPrice;
        
        // Return total tokens required
        return tokensForSale + liquidityTokens;
    }
}