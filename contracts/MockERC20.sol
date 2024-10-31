// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract MockUniswapV2Router02 {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity) {
        return (amountADesired, amountBDesired, amountADesired); // Simplified return for testing
    }
}

contract MockUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external pure returns (address pair) {
        return address(0x1234); // Dummy address for testing
    }
    
    function createPair(address tokenA, address tokenB) external pure returns (address pair) {
        return address(0x1234); // Dummy address for testing
    }
}