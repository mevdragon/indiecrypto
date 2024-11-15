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
// Also can accept plain erc20 transfers and founders manually use the tx history to determine presale token entitlement
contract PresaleLock is ReentrancyGuard {

    // Deposit tracks individual presale buys
    struct Deposit {
        address recipient;
        uint256 amount;
        uint256 unlockUnixTime;
        uint256 depositId;
        bool isRedeemed;
        bool isCanceled;
        bytes32 txHash;
    }

    // State variables
    string public title;
    address public foundersWallet;
    address public otterpadFund = address(0);
    address public saleToken = address(0);
    uint256 public depositCounter = 0;
    
    // Mappings
    mapping(uint256 => Deposit) public deposits;
    mapping(address => uint256[]) public userDepositIds;
    mapping(bytes32 => uint256[]) public txHashToDepositIds;

    // Fees
    uint256 public constant BPS_FACTOR = 100_000_000;       // 100% in 6 decimals
    uint256 public constant OTTERPAD_FEE_BPS = 2_000_000;   // 2% in 6 decimals
    address public constant OTTERPAD_DAO = 0xC6F778fb08f40c0305c3c056c42406614492de44; // OtterPad DAO address
    
    // Events
    event DepositLocked(
        uint256 indexed depositId,
        address indexed recipient,
        uint256 amount,
        uint256 unlockUnixTime,
        uint256 blockNumber,
        uint256 timestamp,
        bytes32 txHash
    );

    event DepositCanceled(
        uint256 indexed depositId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );
    
    event RedeemUnlocked(
        uint256 indexed depositId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );

    event CollectTokens(
        address indexed tokenAddress,
        address indexed recipient,
        uint256 amount,
        uint256 feeAmount,
        uint256 timestamp
    );
    
    constructor(string memory _title, address _foundersWallet) {
        title = _title;
        foundersWallet = _foundersWallet;
    }

    function setFundraiser(address _otterpadFund) external nonReentrant {
        require(_otterpadFund != address(0), "Invalid OtterPad fund address");
        require(msg.sender == foundersWallet, "Only founders can set OtterPad fund");
        
        otterpadFund = _otterpadFund;
        saleToken = address(IOtterpadFund(_otterpadFund).saleToken());
    }

    function deposit(
        uint256 amount,
        address recipient,
        uint256 unlockUnixTime, // unix seconds, not milliseconds
        bytes32 txHash // pass in zero address if no txHash. we use txHash to avoid accidental double deposits
    ) external nonReentrant {
        require(otterpadFund != address(0), "OtterPad fund not set yet");
        require(saleToken != address(0), "Sale token not set yet");
        require(amount > 0, "Amount must be greater than 0");
        require(recipient != address(0), "Invalid recipient address");
        require(msg.sender == foundersWallet, "Only founders can set OtterPad fund");
        
        // Approve and transfer tokens to this contract
        require(
            IERC20(saleToken).approve(address(this), amount),
            "Approval failed"
        );
        require(
            IERC20(saleToken).transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );
        
        // Create and store deposit
        uint256 currentDepositId = depositCounter;
        deposits[currentDepositId] = Deposit({
            recipient: recipient,
            amount: amount,
            unlockUnixTime: unlockUnixTime,
            depositId: currentDepositId,
            isRedeemed: false,
            isCanceled: false,
            txHash: txHash
        });
        
        // Store deposit id for recipient
        userDepositIds[recipient].push(currentDepositId);
        txHashToDepositIds[txHash].push(currentDepositId);
        
        // Increment counter for next deposit
        depositCounter++;
        
        // Emit event
        emit DepositLocked(
            currentDepositId,
            recipient,
            amount,
            unlockUnixTime,
            block.number,
            block.timestamp,
            txHash
        );
    }

    function cancelDeposit(uint256 depositId) external nonReentrant {
        require(msg.sender == foundersWallet, "Only founders can cancel deposits");
        require(otterpadFund != address(0), "OtterPad fund not set yet");
        require(saleToken != address(0), "Sale token not set yet");
        
        Deposit storage dep = deposits[depositId];
        require(dep.recipient != address(0), "Deposit does not exist");
        require(dep.amount > 0, "Invalid deposit amount");
        require(!dep.isRedeemed, "Already redeemed");
        require(!dep.isCanceled, "Already canceled");
        
        dep.isCanceled = true;
        
        require(
            IERC20(saleToken).transfer(foundersWallet, dep.amount),
            "Token transfer failed"
        );
        
        emit DepositCanceled(
            depositId,
            dep.recipient,
            dep.amount,
            block.timestamp
        );
    }
    
    function redeem(uint256 depositId) external nonReentrant {
        require(otterpadFund != address(0), "OtterPad fund not set yet");
        require(saleToken != address(0), "Sale token not set yet");
        Deposit storage dep = deposits[depositId];
        require(dep.recipient != address(0), "Deposit does not exist");
        require(!dep.isRedeemed, "Already redeemed");
        require(!dep.isCanceled, "Deposit was canceled");
        
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
            IERC20(saleToken).transfer(dep.recipient, dep.amount),
            "Token transfer failed"
        );
        
        // Emit event
        emit RedeemUnlocked(
            depositId,
            dep.recipient,
            dep.amount,
            block.timestamp
        );
    }

    function getUserDepositIds(address user) external view returns (uint256[] memory) {
        return userDepositIds[user];
    }

    function getSaleTokenBalance() external view returns (uint256) {
        return IERC20(saleToken).balanceOf(address(this));
    }

    function getERC20TokenBalance(address tokenAddress) external view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    function checkIfTxHashHasDeposits(bytes32 txHash) external view returns (uint256[] memory) {
        return txHashToDepositIds[txHash];
    }

    // Recover any remaining tokens in the contract after DEX deployment
    // Only founders can recover any token except the sale token
    function collectTokensAsFounders(
        address tokenAddress
    ) external nonReentrant {
        require(tokenAddress != address(saleToken), "Cannot recover sale token");
        
        IERC20 token = IERC20(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        
        // Calculate fee
        uint256 feeAmount = (balance * OTTERPAD_FEE_BPS) / BPS_FACTOR;
        uint256 foundersAmount = balance - feeAmount;
        
        // Transfer fee to OtterPad DAO
        require(token.transfer(OTTERPAD_DAO, feeAmount), "Fee transfer failed");
        
        // Transfer remaining tokens to founders
        require(token.transfer(foundersWallet, foundersAmount), "Founders transfer failed");

        emit CollectTokens(
            tokenAddress,
            foundersWallet,
            foundersAmount,
            feeAmount,
            block.timestamp
        );
    }
}