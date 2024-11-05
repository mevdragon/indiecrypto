// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ReentrantToken is ERC20 {
    address public immutable fundraiser;
    
    constructor(address _fundraiser) ERC20("ReentrantToken", "REENT") {
        fundraiser = _fundraiser;
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function transferFrom(address sender, address recipient, uint256 amount) 
        public 
        virtual 
        override 
        returns (bool) 
    {
        if (recipient == fundraiser) {
            // Attempt reentrancy
            (bool success,) = fundraiser.call(
                abi.encodeWithSignature("buy(uint256)", amount)
            );
            require(!success, "Reentrancy should have failed");
        }
        return super.transferFrom(sender, recipient, amount);
    }
}