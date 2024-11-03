// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./OtterPadFund.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

// github@mevdragon
contract OtterPadFactory {
    // Immutable variables from constructor
    IUniswapV2Router02 public immutable uniswapRouter;
    IUniswapV2Factory public immutable uniswapFactory;
    
    // Fund tracking
    uint256 public fundCounterIndex;
    mapping(uint256 => address) public funds;
    
    // Events
    event FundCreated(
        uint256 indexed fundIndex,
        address indexed fund,
        address indexed saleToken,
        address paymentToken,
        string title,
        uint256 targetLiquidity,
        uint256 upfrontRakeBPS,
        uint256 escrowRakeBPS,
        address foundersWallet,
        address lockLPTokenWallet
    );
    
    constructor(
        address _uniswapRouter,
        address _uniswapFactory
    ) {
        require(_uniswapRouter != address(0), "Invalid router address");
        require(_uniswapFactory != address(0), "Invalid factory address");
        
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        uniswapFactory = IUniswapV2Factory(_uniswapFactory);
        
        // Initialize counter
        fundCounterIndex = 0;
    }
    
    function createFundraiser(
        uint256 upfrontRakeBPS,
        uint256 escrowRakeBPS,
        uint256 startPrice,
        uint256 endPrice,
        uint256 targetLiquidity,
        address saleToken,
        address paymentToken,
        address foundersWallet,
        string memory title,
        string memory richInfoUrl,
        address lockLPTokenWallet
    ) external returns (address) {
        // Input validation
        require(saleToken != address(0), "Invalid sale token");
        require(paymentToken != address(0), "Invalid payment token");
        require(foundersWallet != address(0), "Invalid founders wallet");
        require(bytes(title).length > 0, "Empty title");
        require(startPrice > 0, "Invalid start price");
        require(endPrice > startPrice, "End price must exceed start price");
        require(targetLiquidity > 0, "Invalid target liquidity");
        
        // Create new fundraiser instance
        OtterPadFund fundraiser = new OtterPadFund(
            title,
            richInfoUrl,
            saleToken,
            paymentToken,
            address(uniswapRouter),
            address(uniswapFactory),
            startPrice,
            endPrice,
            targetLiquidity,
            upfrontRakeBPS,
            escrowRakeBPS,
            foundersWallet,
            lockLPTokenWallet
        );
        
        // Store fundraiser address in mapping
        uint256 currentIndex = fundCounterIndex;
        funds[currentIndex] = address(fundraiser);
        
        // Increment counter for next deployment
        fundCounterIndex++;
        
        // Emit creation event with fund index and additional parameters
        emit FundCreated(
            currentIndex,
            address(fundraiser),
            saleToken,
            paymentToken,
            title,
            targetLiquidity,
            upfrontRakeBPS,
            escrowRakeBPS,
            foundersWallet,
            lockLPTokenWallet
        );
        
        return address(fundraiser);
    }
}