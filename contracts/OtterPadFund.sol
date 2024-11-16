// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
// import "hardhat/console.sol";


// github@mevdragon
// OtterPad aka IndieCrypto
contract OtterPadFund is ReentrancyGuard {
    struct Purchase {
        uint256 paymentAmount;      // Total amount paid by user in payment token wei
        uint256 contributionAmount; // Amount towards liquidity after upfront rake, escrow rake, and otterpad fee
        uint256 tokenAmount;        // Calculated token to be received in wei
        address purchaser;          // Address of the purchaser
        address recipient;          // Address of the recipient
        bool isRefunded;            // Whether the purchase was refunded
        bool isRedeemed;            // Whether the purchase was redeemed
        uint256 purchaseBlock;      // Block number of the purchase
        uint256 orderIndex;
    }

    IERC20Metadata public immutable saleToken;  // The token being sold
    string public saleTokenSymbol;              // Symbol of the sale token
    uint8 public saleTokenDecimals;             // Decimals of the sale token

    IERC20Metadata public immutable paymentToken;   // The token used for payment
    string public paymentTokenSymbol;               // Symbol of the payment token
    uint8 public paymentTokenDecimals;              // Decimals of the payment token

    IUniswapV2Router02 public immutable uniswapRouter; // UniswapV2 router
    IUniswapV2Factory public immutable uniswapFactory; // UniswapV2 factory
    
    uint256 public immutable startPrice;        // Initial price in wei of payment token
    uint256 public immutable endPrice;          // Final price in wei of payment token
    uint256 public immutable targetLiquidity;   // Target liquidity in wei of payment token
    
    uint256 public constant BPS_FACTOR = 100_000_000;       // 100% in 6 decimals
    uint256 public constant OTTERPAD_FEE_BPS = 2_000_000;   // 2% in 6 decimals
    uint256 public immutable upfrontRakeBPS;                // Percentage of payment tokens immediately sent to founders and OtterPad fee
    uint256 public immutable escrowRakeBPS;                 // Percentage of payment tokens held in escrow for founders, released at DEX deployment
    uint256 public immutable slopeScalingFactor = 10**12;   // Scaling factor for slope calculation
    uint256 private immutable wei_forgiveness_buffer = 100; // 100 wei allowed difference for deployment
    
    address public immutable foundersWallet;                // Wallet of founders receive upfront rake & escrow rake
    address public constant OTTERPAD_DAO = 0xC6F778fb08f40c0305c3c056c42406614492de44; // OtterPad DAO address
    address public immutable lockLPTokenWallet;             // Address to receive LP tokens from Uniswap deployment
    address public uniswapPool;                             // Address of the UniswapV2 pool from DEX deployment
    
    uint256 public orderCounter;        // Counter for purchase order indices
    bool public isDeployedToUniswap;    // Whether the contract has been deployed to Uniswap
    bool public targetReached;          // Whether the target liquidity has been reached
    
    uint256 public totalTokensAllocated;     // Sales token allocated for buyers only (not liquidity)
    uint256 public totalActiveContributions; // Payment tokens contributed towards liquidity
    uint256 public totalPaymentsIn;          // Payment tokens received from buyers historically, including refunded amounts (refunds dont decrease this)

    string public title;                // Title of the fundraiser
    string public richInfoUrl;          // Link to json info about the fundraiser
    
    mapping(uint256 => Purchase) public purchases;              // Purchase order index to Purchase struct
    mapping(address => uint256[]) public userOrderIndices;      // User address to array of order indices
    
    // Tracks purchase history
    event TokensPurchased(
        address indexed purchaser,
        address indexed recipient,
        uint256 paymentAmount, 
        uint256 contributionAmount,
        uint256 tokenAmount,
        uint256 indexed orderIndex,
        uint256 netActiveContributions,
        uint256 timestamp
    );
    // Tracks token redemption history
    event TokensRedeemed(
        address indexed recipient,
        uint256 tokenAmount,
        uint256 indexed orderIndex
    );
    // Tracks refund history
    event Refunded(
        address indexed purchaser, 
        uint256 contributionAmount, 
        uint256 indexed orderIndex,
        uint256 netActiveContributions,
        uint256 timestamp
    );
    // Tracks payment distribution history from buy function
    event PaymentReceived(
        address indexed purchaser,
        address indexed recipient,
        uint256 totalAmount,
        uint256 otterpadFee,
        uint256 upfrontAmount,
        uint256 escrowAmount,
        uint256 contributionAmount
    );
    // Tracks deployment to Uniswap
    event DeployedToUniswap(address pair, uint256 liquidity);
    // Tracks escrow release
    event EscrowReleased(uint256 amount, address foundersWallet);
    
    // Initialize the fundraiser
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
        require(_upfrontRakeBPS + _escrowRakeBPS <= 70_000_000, "Combined rake 70% exceeded");
        require(_foundersWallet != address(0), "Invalid founders wallet");
        require(_saleToken != address(0) && _paymentToken != address(0), "Invalid token addresses");
        require(_saleToken != _paymentToken, "Tokens must be different");
        require(_uniswapRouter != address(0) && _uniswapFactory != address(0), "Invalid Uniswap addresses");
        require(BPS_FACTOR - upfrontRakeBPS - escrowRakeBPS > 0, "Invalid rake parameters");
        
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
        
        startPrice = _startPrice;
        endPrice = _endPrice;
        targetLiquidity = _targetLiquidity;
        upfrontRakeBPS = _upfrontRakeBPS;
        escrowRakeBPS = _escrowRakeBPS;
        foundersWallet = _foundersWallet;
    }

    // Amount of sale tokens owned by this fundraiser contract
    function getSaleTokenBalance() external view returns (uint256) {
        return saleToken.balanceOf(address(this));
    }
    // Amount of payment tokens owned by this fundraiser contract
    function getPaymentTokenBalance() external view returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }
    // Amount of escrowed payment tokens owned by this fundraiser contract (to be released to founders at DEX deployment)
    function getEscrowedAmount() public view returns (uint256) {
        uint256 netContributionBPS = BPS_FACTOR - upfrontRakeBPS - escrowRakeBPS;
        uint256 grossAmount = (totalActiveContributions * BPS_FACTOR) / netContributionBPS;
        return (grossAmount * escrowRakeBPS) / BPS_FACTOR;
    }
    // Slope of the sale token bonding curve
    function getSlope () public view returns (uint256) {
        
        uint256 totalCashInflows = targetLiquidity * BPS_FACTOR / (BPS_FACTOR - upfrontRakeBPS - escrowRakeBPS);
        
        uint256 avgPrice = ((startPrice + endPrice) / 2);
        
        uint256 proratedPayChunksForSale = totalCashInflows * (10**paymentTokenDecimals) / avgPrice;
        
        uint256 salesTokensForSale = proratedPayChunksForSale * (10**saleTokenDecimals) / 10**paymentTokenDecimals;
        
        uint256 slope = (endPrice - startPrice) * (10**saleTokenDecimals) * slopeScalingFactor / salesTokensForSale;
        
        return slope;
    }
    // Current payment token wei price of the sale token on bonding curve
    function getCurrentPrice() public view returns (uint256) {
        
        uint256 netCashInflows = totalActiveContributions * BPS_FACTOR / (BPS_FACTOR - upfrontRakeBPS - escrowRakeBPS);
        
        uint256 tokensIssuedSoFar = _calculateTokensReceived(netCashInflows);
        
        uint256 currentPrice = startPrice + (tokensIssuedSoFar * getSlope() / (10**saleTokenDecimals)) / slopeScalingFactor;
        
        return currentPrice;
    }
    // internal function to calculate the exact amount of sale tokens received for a given payment amount
    // uses the quadratic formula to solve for the integral of a linear price curve
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
        
        uint256 b = startPrice * slopeScalingFactor;
        int256 m = int256(getSlope());
        int256 a = m / 2;
        int256 negB = -int256(b);
        int256 bSquared = int256(b)**2;
        int256 fourAC = 4*a*int256(paymentAmount)*int256(slopeScalingFactor);
        int256 squareRootPortion = int256(Math.sqrt(
            uint256(bSquared + fourAC)
        ));
        int256 twoA = (2*a);
        int256 saleTokensReceived = (negB + squareRootPortion) * int256(10**saleTokenDecimals) / twoA;
        
        return uint256(saleTokensReceived);
    }
    
    // Calculate the amount of sale tokens received for a given payment amount, at the current price
    // Eg. If theres already been P payment tokens contributed, how many sale tokens would be received for a new p payment?
    function calculateTokensReceived(uint256 paymentAmount) public view returns (uint256) {

        
        uint256 otterpadFee = (paymentAmount * OTTERPAD_FEE_BPS) / BPS_FACTOR;
        
        uint256 upfrontAmount = (paymentAmount * upfrontRakeBPS) / BPS_FACTOR - otterpadFee;
        
        uint256 escrowAmount = (paymentAmount * escrowRakeBPS) / BPS_FACTOR;
        
        uint256 contributionAmount = paymentAmount - upfrontAmount - escrowAmount - otterpadFee;
        
        require(totalActiveContributions + contributionAmount <= targetLiquidity, "Exceeds target");
        uint256 netCashInflows = totalActiveContributions * BPS_FACTOR / (BPS_FACTOR - upfrontRakeBPS - escrowRakeBPS);
        
        uint256 salesTokensIssuedThusFar = _calculateTokensReceived(netCashInflows);
        
        uint256 salesTokensIssuedAfterThisPurchase = _calculateTokensReceived(netCashInflows + paymentAmount);
        
        uint256 netNewSalesTokensIssued = salesTokensIssuedAfterThisPurchase - salesTokensIssuedThusFar;
        
        return netNewSalesTokensIssued;
    }
    
    // Purchase sale tokens with payment tokens
    // This will actually transfer payment tokens from buyer wallet into this contract
    function buy(uint256 paymentAmount, address recipient) external nonReentrant {
        
        
        require(!isDeployedToUniswap, "Sale completed");
        require(paymentAmount > 0, "Invalid payment amount");
        require(recipient != address(0), "Invalid recipient");
        
        uint256 otterpadFee = (paymentAmount * OTTERPAD_FEE_BPS) / BPS_FACTOR;
        
        uint256 upfrontAmount = (paymentAmount * upfrontRakeBPS) / BPS_FACTOR - otterpadFee;
        
        uint256 escrowAmount = (paymentAmount * escrowRakeBPS) / BPS_FACTOR;
        
        uint256 contributionAmount = paymentAmount - otterpadFee - upfrontAmount - escrowAmount;
        
        
        require(totalActiveContributions + contributionAmount <= targetLiquidity, "Exceeds target");
        
        uint256 tokenAmount = calculateTokensReceived(paymentAmount);
        
        
        require(
            paymentToken.transferFrom(msg.sender, address(this), paymentAmount),
            "Payment transfer failed"
        );
        
        emit PaymentReceived(
            msg.sender,
            recipient,
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
            recipient: recipient,
            isRefunded: false,
            isRedeemed: false,
            purchaseBlock: block.number,
            orderIndex: orderIndex
        });
        
        
        userOrderIndices[recipient].push(orderIndex);
        
        totalTokensAllocated += tokenAmount;
        
        totalActiveContributions += contributionAmount;
        
        totalPaymentsIn += paymentAmount;
        
        
        emit TokensPurchased(msg.sender, recipient, paymentAmount, contributionAmount, tokenAmount, orderIndex, totalActiveContributions, block.timestamp);
        
        if (totalActiveContributions >= targetLiquidity - wei_forgiveness_buffer) {
            targetReached = true;
        }
    }

    // Redeem sale tokens from purchase order
    // This will actually transfer sale tokens from this contract into buyer wallet
    function redeem(uint256 orderIndex) external nonReentrant {
        require(targetReached, "Target not reached yet");
        require(isDeployedToUniswap, "Not yet deployed to DEX");
        Purchase storage purchase = purchases[orderIndex];
        require(purchase.purchaser != address(0), "Order does not exist");
        require(!purchase.isRefunded, "Order was refunded");
        require(!purchase.isRedeemed, "Already redeemed");
        
        require(purchase.tokenAmount > 0, "No tokens to redeem");
        
        purchase.isRedeemed = true;
        require(saleToken.transfer(purchase.recipient, purchase.tokenAmount), "Token transfer failed");
        
        emit TokensRedeemed(purchase.recipient, purchase.tokenAmount, orderIndex);
    }

    // Refund payment tokens from purchase order
    // This will actually transfer payment tokens from this contract back into buyer wallet
    // Refunded amount is the original payment tokens minus the upfront rake
    function refund(uint256 orderIndex) external nonReentrant {
        require(!isDeployedToUniswap, "Sale completed");
        Purchase storage purchase = purchases[orderIndex];
        require(purchase.purchaser != address(0), "Order does not exist");
        require(purchase.purchaser == msg.sender, "Not the purchaser");
        require(!purchase.isRefunded, "Already refunded");
        require(!purchase.isRedeemed, "Already redeemed");
        
        purchase.isRefunded = true;
        
        totalTokensAllocated -= purchase.tokenAmount;
        
        totalActiveContributions -= purchase.contributionAmount;
        

        uint256 cashPaidInAmount = purchase.contributionAmount * BPS_FACTOR / (BPS_FACTOR - upfrontRakeBPS - escrowRakeBPS);
        
        uint256 escrowAmount = (cashPaidInAmount * escrowRakeBPS) / BPS_FACTOR;
        
        uint256 refundAmount = purchase.contributionAmount + escrowAmount;
        
        
        require(paymentToken.transfer(purchase.purchaser, refundAmount), "Refund failed");
        
        emit Refunded(msg.sender, refundAmount, orderIndex, totalActiveContributions, block.timestamp);

        targetReached = false;
    }

    // Check if the contract has sufficient sale tokens to deploy to Uniswap
    function hasSufficientSaleTokens() external view returns (bool) {
        return saleToken.balanceOf(address(this)) >= checkSaleTokensRequired()[0];
    }
    // Internal function to check if the contract has sufficient sale tokens to deploy to Uniswap
    function _hasSufficientSaleTokens() internal view returns (bool) {
        return saleToken.balanceOf(address(this)) >= checkSaleTokensRequired()[0];
    }

    // Deploy the contract to UniswapV2 pool
    // This will actually transfer sale & payment tokens from this fundraiser contract into a UniswapV2 liquidity pool
    // Expects there to be no existing UniswapV2 liquidity pool for this pair
    // After deployment, there should remain zero payment tokens, and an amount of sale tokens equal to what buyers have purchased - they can now redeem them using redeem()
    function deployToUniswap() external returns (address pool) {
        require(targetReached, "Target not reached");
        require(!isDeployedToUniswap, "Already deployed");
        
        uint256 escrowAmount = getEscrowedAmount();
        
        require(_hasSufficientSaleTokens(), "Insufficient sale tokens");
        
        uint256 saleTokenBase = 10 ** saleTokenDecimals;
        
        uint256 complimentarySalesTokensLiquidity = (targetLiquidity * saleTokenBase) / endPrice;


        require(saleToken.balanceOf(address(this)) >= complimentarySalesTokensLiquidity, "Insufficient sale tokens");
        require(paymentToken.balanceOf(address(this)) >= targetLiquidity + escrowAmount - wei_forgiveness_buffer, 
            "Insufficient payment tokens");

        uint256 actualPaymentTokenAmount = (targetLiquidity < paymentToken.balanceOf(address(this)) ? targetLiquidity : paymentToken.balanceOf(address(this))) - wei_forgiveness_buffer;
        
        
        
        require(saleToken.approve(address(uniswapRouter), complimentarySalesTokensLiquidity), "Token approve failed");
        require(paymentToken.approve(address(uniswapRouter), targetLiquidity), "Payment approve failed");
        
        (uint256 amountA, uint256 amountB, uint256 liquidity) = uniswapRouter.addLiquidity(
            address(saleToken),
            address(paymentToken),
            complimentarySalesTokensLiquidity, 
            actualPaymentTokenAmount,
            complimentarySalesTokensLiquidity,
            actualPaymentTokenAmount,
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
    
    // Get the total amount of sale tokens allocated to a given buyer
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
    
    // Get the purchase order indices for a given buyer
    function getUserOrderIndices(address user) external view returns (uint256[] memory) {
        return userOrderIndices[user];
    }

    // Recover any remaining tokens in the contract after DEX deployment
    // Only founders can recover any token except the sale token
    function recoverStuckTokens(
        address tokenAddress
    ) external nonReentrant {
        require(msg.sender == foundersWallet, "Only founders can recover");
        require(isDeployedToUniswap, "Not yet deployed to Uniswap");
        require(tokenAddress != address(saleToken), "Cannot recover sale token");
        
        IERC20 token = IERC20(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        
        require(token.transfer(foundersWallet, balance), "Token recovery failed");
    }

    // Check the amount of sale tokens required to deploy to Uniswap plus what is owed to buyers for redeem()
    function checkSaleTokensRequired() public view returns (uint256[3] memory) {
        
        uint256 proratedLiquidity = (targetLiquidity * 10 ** paymentTokenDecimals) / endPrice;
        uint256 salesTokensForLiquidity = proratedLiquidity * (10**saleTokenDecimals) / 10**paymentTokenDecimals;
        
        uint256 totalCashInflows = targetLiquidity * BPS_FACTOR / (BPS_FACTOR - upfrontRakeBPS - escrowRakeBPS);
        uint256 avgPrice = ((startPrice + endPrice) / 2);
        uint256 proratedTokensForSale = totalCashInflows * (10**paymentTokenDecimals) / avgPrice;
        uint256 salesTokensForSale = proratedTokensForSale * (10**saleTokenDecimals) / 10**paymentTokenDecimals;
        
        uint256 totalSalesTokens = salesTokensForLiquidity + salesTokensForSale;
        return [totalSalesTokens, salesTokensForLiquidity, salesTokensForSale];
    }
}