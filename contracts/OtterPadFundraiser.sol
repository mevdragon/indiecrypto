// OtterPadFundraiser.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract OtterPadFundraiser is ReentrancyGuard {
    struct Purchase {
        uint256 paymentAmount;      // Total amount paid by user
        uint256 contributionAmount; // Amount after otterpad fee and upfront rake
        uint256 tokenAmount;       // Calculated token amount at purchase time
        address purchaser;
        bool isRefunded;
        bool isRedeemed;
        uint256 purchaseBlock;
    }

    IERC20 public immutable saleToken;
    IERC20 public immutable paymentToken;
    
    uint256 public immutable startPrice;
    uint256 public immutable endPrice;
    uint256 public immutable targetLiquidity;
    
    uint256 public constant OTTERPAD_FEE_BPS = 100;  // 1% in basis points
    uint256 public immutable upfrontRakeBPS;         // Basis points taken upfront (includes otterpad fee)
    uint256 public immutable escrowRakeBPS;          // Basis points held in escrow
    
    address public immutable foundersWallet;
    address public constant OTTERPAD_DAO = 0x6c83e86e05697C995d718C1cfA3F9045A38C7cd4;
    
    uint256 public orderCounter; // immutable counter (includes refunded orders)
    bool public isDeployedToUniswap;
    bool public targetReached;
    
    // Running totals
    uint256 public totalTokensAllocated;
    uint256 public totalActiveContributions;
    uint256 public totalPaymentsIn;
    
    mapping(uint256 => Purchase) public purchases; // orderCounter => Purchase
    mapping(address => uint256[]) public userOrderIndices; // address => orderCounter[]
    
    event TokensPurchased(
        address indexed purchaser,
        uint256 paymentAmount, 
        uint256 contributionAmount,
        uint256 tokenAmount,
        uint256 indexed orderIndex
    );
    event TokensRedeemed(
        address indexed purchaser,
        uint256 tokenAmount,
        uint256 indexed orderIndex
    );
    event Refunded(
        address indexed purchaser, 
        uint256 contributionAmount, 
        uint256 indexed orderIndex
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
        address _saleToken,
        address _paymentToken,
        uint256 _startPrice,
        uint256 _endPrice,
        uint256 _targetLiquidity,
        uint256 _upfrontRakeBPS,
        uint256 _escrowRakeBPS,
        address _foundersWallet
    ) {
        require(_startPrice > 0 && _endPrice > 0 && _endPrice > _startPrice, "Invalid prices");
        require(_targetLiquidity > 0, "Invalid target funding");
        require(_upfrontRakeBPS >= OTTERPAD_FEE_BPS, "Upfront rake must be >= OtterPad fee");
        require(_upfrontRakeBPS + _escrowRakeBPS <= 7000, "Combined rake 70% exceeded");
        require(_foundersWallet != address(0), "Invalid founders wallet");
        require(_saleToken != address(0) && _paymentToken != address(0), "Invalid token addresses");
        require(_saleToken != _paymentToken, "Tokens must be different");
        
        saleToken = IERC20(_saleToken);
        paymentToken = IERC20(_paymentToken);
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

    function hasSufficientSaleTokens() external view returns (bool) {
        return saleToken.balanceOf(address(this)) >= totalTokensAllocated;
    }

    function getEscrowedAmount() public view returns (uint256) {
        return (totalPaymentsIn * escrowRakeBPS) / 10000;
    }
    
    function getCurrentPrice() public view returns (uint256) {
        if (totalActiveContributions >= targetLiquidity) return endPrice;
        return startPrice + ((endPrice - startPrice) * totalActiveContributions / targetLiquidity);
    }
    
    function calculateTokensReceived(uint256 contributionAmount) public view returns (uint256) {
        require(totalActiveContributions + contributionAmount <= targetLiquidity, "Exceeds target");
        
        // Integration using average price method for linear price curve
        uint256 priceAtStart = getCurrentPrice();
        uint256 priceAtEnd = startPrice + ((endPrice - startPrice) * (totalActiveContributions + contributionAmount) / targetLiquidity);
        uint256 averagePrice = (priceAtStart + priceAtEnd) / 2;
        
        return (contributionAmount * 1e18) / averagePrice;
    }
    
    function buy(uint256 paymentAmount) external nonReentrant {
        require(!isDeployedToUniswap, "Sale completed");
        require(!targetReached, "Target already reached");
        require(paymentAmount >= getMinimumPurchase(), "Below minimum purchase");
        
        // Calculate fees and amounts
        uint256 otterpadFee = (paymentAmount * OTTERPAD_FEE_BPS) / 10000;  // 1% fee
        uint256 upfrontAmount = (paymentAmount * upfrontRakeBPS) / 10000 - otterpadFee;
        uint256 escrowAmount = (paymentAmount * escrowRakeBPS) / 10000;
        uint256 contributionAmount = paymentAmount - otterpadFee - upfrontAmount - escrowAmount;
        
        require(totalActiveContributions + contributionAmount <= targetLiquidity, "Exceeds target");
        
        // Calculate tokens before any state changes
        uint256 tokenAmount = calculateTokensReceived(contributionAmount);
        
        // Transfer payment tokens from sender
        require(
            paymentToken.transferFrom(msg.sender, address(this), paymentAmount),
            "Payment transfer failed"
        );
        
        // Emit detailed payment breakdown
        emit PaymentReceived(
            msg.sender,
            paymentAmount,
            otterpadFee,
            upfrontAmount,
            escrowAmount,
            contributionAmount
        );
        
        // Distribute and track fees
        require(paymentToken.transfer(OTTERPAD_DAO, otterpadFee), "Fee transfer failed");
        require(paymentToken.transfer(foundersWallet, upfrontAmount), "Upfront transfer failed");

        // Record purchase
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
        
        // Update running totals
        totalTokensAllocated += tokenAmount;
        totalActiveContributions += contributionAmount;
        totalPaymentsIn += paymentAmount;
        
        emit TokensPurchased(msg.sender, paymentAmount, contributionAmount, tokenAmount, orderIndex);
        
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
        
        // Update running totals (note: totalPaymentsIn stays the same)
        totalTokensAllocated -= purchase.tokenAmount;
        totalActiveContributions -= purchase.contributionAmount;
        
        // Return the contribution amount
        require(paymentToken.transfer(msg.sender, purchase.contributionAmount), "Refund failed");
        
        emit Refunded(msg.sender, purchase.contributionAmount, orderIndex);
    }
    
    function deployToUniswap(address uniswapRouter, address uniswapFactory) external {
        require(targetReached, "Target not reached");
        require(!isDeployedToUniswap, "Already deployed");
        require(uniswapRouter != address(0) && uniswapFactory != address(0), "Invalid Uniswap addresses");
        
        uint256 escrowAmount = getEscrowedAmount();
        uint256 liquidityPaymentAmount = totalActiveContributions - escrowAmount;
        
        // Add balance checks
        require(saleToken.balanceOf(address(this)) >= totalTokensAllocated, "Insufficient sale tokens");
        require(paymentToken.balanceOf(address(this)) >= totalActiveContributions, 
            "Insufficient payment tokens");
        
        IUniswapV2Router02 router = IUniswapV2Router02(uniswapRouter);
        
        require(saleToken.approve(address(router), totalTokensAllocated), "Token approve failed");
        require(paymentToken.approve(address(router), liquidityPaymentAmount), "Payment approve failed");
        
        // Deploy liquidity first
        (uint256 amountA, uint256 amountB, uint256 liquidity) = router.addLiquidity(
            address(saleToken),
            address(paymentToken),
            totalTokensAllocated,
            liquidityPaymentAmount,
            totalTokensAllocated,
            liquidityPaymentAmount,
            address(this),
            block.timestamp + 2 minutes
        );
        
        // Only after successful liquidity addition, release escrow
        if (escrowAmount > 0) {
            require(paymentToken.transfer(foundersWallet, escrowAmount), "Escrow release failed");
            emit EscrowReleased(escrowAmount, foundersWallet);
        }
        
        isDeployedToUniswap = true;
        
        emit DeployedToUniswap(
            IUniswapV2Factory(uniswapFactory).getPair(address(saleToken), address(paymentToken)),
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
}