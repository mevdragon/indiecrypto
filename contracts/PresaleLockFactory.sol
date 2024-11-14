// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./PresaleLock.sol";

// github@mevdragon
contract PresaleLockFactory {
    // History of created locks
    uint256 public lockCounterIndex;
    mapping(uint256 => address) public locks;
    
    // Event for tracking lock creation
    event LockCreated(
        uint256 indexed lockIndex,
        address indexed lock,
        string title,
        address foundersWallet,
        uint256 timestamp
    );
    
    constructor() {
        lockCounterIndex = 0;
    }
    
    function createLock(
        string memory title,
        address foundersWallet
    ) external returns (address) {
        require(foundersWallet != address(0), "Invalid founders wallet");
        require(bytes(title).length > 0, "Empty title");
        
        PresaleLock lock = new PresaleLock(
            title,
            foundersWallet
        );
        
        uint256 currentIndex = lockCounterIndex;
        locks[currentIndex] = address(lock);
        
        lockCounterIndex++;
        
        emit LockCreated(
            currentIndex,
            address(lock),
            title,
            foundersWallet,
            block.timestamp
        );
        
        return address(lock);
    }
}