// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IOtterpadFund {
    function isDeployedToUniswap() external view returns (bool);
    function saleToken() external view returns (IERC20);
}

// github@mevdragon
// PresaleLock contract for OtterPad (aka IndieCrypto)
// Use this to lock presale tokens so that they can be redeemed at the same time as the OtterPad fundraiser
contract PresaleLock is ReentrancyGuard {

    // Deposit tracks individual presale buys
    struct Deposit {
        address recipient;
        uint256 amount;
        uint256 unlockUnixTime;
        uint256 depositId;
        bool isRedeemed;
    }

    // State variables
    address public immutable otterpadFund;
    IERC20 public immutable saleToken;
    uint256 public depositCounter;
    
    // Mappings
    mapping(uint256 => Deposit) public deposits;
    mapping(address => uint256[]) public userDepositIds;
    
    // Events
    event DepositLocked(
        address indexed recipient,
        uint256 amount,
        uint256 unlockUnixTime,
        uint256 indexed depositId,
        uint256 blockNumber,
        uint256 timestamp
    );
    
    event RedeemUnlocked(
        address indexed recipient,
        uint256 amount,
        uint256 indexed depositId,
        uint256 timestamp
    );
    
    constructor(address _otterpadFund, address _saleToken) {
        require(_otterpadFund != address(0), "Invalid OtterPad fund address");
        require(_saleToken != address(0), "Invalid sale token address");
        
        // Verify sale token matches OtterpadFund's sale token
        require(
            IOtterpadFund(_otterpadFund).saleToken() == IERC20(_saleToken),
            "Sale token mismatch"
        );
        
        otterpadFund = _otterpadFund;
        saleToken = IERC20(_saleToken);
    }

    function deposit(
        uint256 amount,
        address recipient,
        uint256 unlockUnixTime
    ) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(recipient != address(0), "Invalid recipient address");
        
        // Approve and transfer tokens to this contract
        require(
            saleToken.approve(address(this), amount),
            "Approval failed"
        );
        require(
            saleToken.transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );
        
        // Create and store deposit
        uint256 currentId = depositCounter;
        deposits[currentId] = Deposit({
            recipient: recipient,
            amount: amount,
            unlockUnixTime: unlockUnixTime,
            depositId: currentId,
            isRedeemed: false
        });
        
        // Store deposit id for recipient
        userDepositIds[recipient].push(currentId);
        
        // Increment counter for next deposit
        depositCounter++;
        
        // Emit event
        emit DepositLocked(
            recipient,
            amount,
            unlockUnixTime,
            currentId,
            block.number,
            block.timestamp
        );
    }
    
    function redeem(uint256 depositId) external nonReentrant {
        Deposit storage dep = deposits[depositId];
        require(dep.recipient != address(0), "Invalid deposit");
        require(!dep.isRedeemed, "Already redeemed");
        
        // Check if OtterPad sale is complete
        require(
            IOtterpadFund(otterpadFund).isDeployedToUniswap(),
            "OtterPad sale not complete"
        );
        
        // Check if unlock time has passed
        require(
            block.timestamp >= dep.unlockUnixTime,
            "Tokens still locked"
        );
        
        // Mark as redeemed before transfer
        dep.isRedeemed = true;
        
        // Transfer tokens to recipient
        require(
            saleToken.transfer(dep.recipient, dep.amount),
            "Token transfer failed"
        );
        
        // Emit event
        emit RedeemUnlocked(
            dep.recipient,
            dep.amount,
            depositId,
            block.timestamp
        );
    }

    function getUserDepositIds(address user) external view returns (uint256[] memory) {
        return userDepositIds[user];
    }

    function getSaleTokenBalance() external view returns (uint256) {
        return saleToken.balanceOf(address(this));
    }
}