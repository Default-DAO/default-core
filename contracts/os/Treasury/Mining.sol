// SPDX-License-Identifier: MIT

// Do mining as allocation on vaults. E.g. 5 alloc -> usdc, 1 alloc -> def => 5/6 rewards go to share holder;


pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "../DefaultOS.sol";
import "../Token/Token.sol";
import "../Epoch/Epoch.sol";
import "./Treasury.sol";
import "./_Vault.sol";

/// @title Installer for Mining module (MNG)
/// @notice Factory contract for the Mining Module
contract def_MiningInstaller is DefaultOSModuleInstaller("MNG") {
    string public moduleName = "Default Treasury Mining";

    /// @notice Install Mining module on a DAO 
    /// @return address Address of Mining module instance
    /// @dev Requires TKN, EPC, and TSY modules to be enabled on DAO. install() is called by the DAO contract
    function install() external override returns (address) {
        def_Mining Mining = new def_Mining(DefaultOS(msg.sender));
        Mining.transferOwnership(msg.sender); 
        return address(Mining);
    }
}

/// @title Mining module (MNG)
/// @notice Allows members of DAO to mine the DEF token. Rewards have a set value that can be changed by the DAO. Rewards are distributed equally to all each held in the vault.
contract def_Mining is DefaultOSModule {

    // Module Configuration
    def_Token private _Token;
    def_Epoch private _Epoch;
    def_Treasury private _Treasury;
    Vault private _vault;


    constructor(DefaultOS os_) DefaultOSModule(os_) {
        _Token = def_Token(_OS.getModule("TKN"));
        _Epoch = def_Epoch(_OS.getModule("EPC"));
        _Treasury = def_Treasury(_OS.getModule("TSY"));
    }


    // emitted events
    event RewardsIssued(uint16 currentEpoch, uint256 newRewardsPerShare);
    event RewardsClaimed(uint16 epochClaimed, address member, uint256 totalRewardsClaimed);
    event Registered(uint16 currentEpoch, address member);


    mapping(address => uint256) unclaimableRewards;
    mapping(address => bool) registered;


    uint256 public accRewardsPerShare = 0;
    uint256 public lastEpochIssued = 1;
    uint256 public constant EPOCH_MINING_REWARDS = 500000; 
    uint256 private constant MULT = 1e12;


    // **********************************************************************
    //                   GOVERNANCE CONTROLLED VARIABLES
    // **********************************************************************

    // weekly rewards to the caller of the issueRewards() function
    uint256 public TOKEN_BONUS = 5000; 

    /// @notice Set weekly token bonus to caller of issueRewards() function.
    /// @param newTokenBonus_ # of tokens to be paid to caller of issueRewards function
    function setTokenBonus(uint256 newTokenBonus_) external onlyOS {
        TOKEN_BONUS = newTokenBonus_;
    }



    // **********************************************************************
    //                 GET THE PENDING REWARDS FOR THE USER
    // **********************************************************************


    /// @notice Calculate the available rewards for the caller. 
    /// @dev Available rewards are calculated as the [[sender's total balance in the vault] X [multipler on the reward per share]] - [unclaimable rewards for the sender]
    /// @dev Rewards are denominated in the token's units / [1e12]
    function pendingRewards() public view returns (uint256) {
        uint256 totalHistoricalRewards = _vault.balanceOf(msg.sender) * accRewardsPerShare;                
        uint256 finalDepositorRewards = (totalHistoricalRewards - unclaimableRewards[msg.sender]) / MULT;

        return finalDepositorRewards;
    }

    
    
    // **********************************************************************
    //                  START THE TREASURY MINING PROGRAM
    // **********************************************************************

    /// @notice Assign the vault contract to be mined. This "activates" the mining program
    /// @param token_ the Address of the token to be mined
    /// @dev The token should have a vault in the treasury before calling this function
    function assignVault(address token_) external onlyOS {        
        require (address(_vault) == address(0), "can only assign vault once");        
        _vault = _Treasury.getVault(token_);
    }



    // **********************************************************************
    //                 ISSUE EPOCH REWARDS TO SHAREHOLDERS
    // **********************************************************************

    // Note: this design is not entirely ideal, because someone could manipulate the system by depositing/withdrawing right before
    // calling the accumulate rewards function. There might be some issues there, not entirely sure though how severe they are 
    // but intuition is telling me it is an okay trade off to make (for now).
    /// @notice Sets the amount of rewards a miner can receive per token deposited in the vault. Rewards are distributed evenly to all tokens in the vault.
    function issueRewards() external {

        // issue only once per epoch
        require (lastEpochIssued != _Epoch.current(), "rewards have already been accumulated for the current epoch");
        require (address(_vault) != address(0), "vault is not configured!");
        require (_vault.totalSupply() > 0, "vault supply has to exist");

        // record that rewards have been issued for the current epoch
        lastEpochIssued = _Epoch.current();

        // rewards per share for this epoch
        uint256 newRewardsPerShare = EPOCH_MINING_REWARDS * MULT / _vault.totalSupply();        
        // increment the accRewardsPerShare based on the total deposits at the time of calling this function
        accRewardsPerShare += newRewardsPerShare;        
        // mint the caller tokens for their service!

        _Token.mint(msg.sender, TOKEN_BONUS);

        emit RewardsIssued(_Epoch.current(), newRewardsPerShare);
    }



    // **********************************************************************
    //                 RESET MINING REWARDS COUNTER FOR USER
    // **********************************************************************

    /// @notice Reset the mining rewards for member to 0.
    /// @dev This function sets unclaimable rewards to the total balance of rewards for the member. This effectively sets rewards to zero since redeemable rewards = total possible rewards - uncaimable rewards
    function register() external {
        // reset the unclaimable rewards to the latest amount.
        unclaimableRewards[msg.sender] = _vault.balanceOf(msg.sender) * accRewardsPerShare;
        registered[msg.sender] = true;

        emit Registered(_Epoch.current(), msg.sender);
    }



    // **********************************************************************
    //                       CLAIM AVAILABLE REWARDS
    // **********************************************************************

    /// @notice Redeem all available rewards 
    function claimRewards() external {
        require (registered[msg.sender], "member is not registered for mining program");
        
        // save the pending rewards available to user
        uint256 rewards = pendingRewards();

        // reset the unclaimable rewards to the latest amount.
        unclaimableRewards[msg.sender] = _vault.balanceOf(msg.sender) * accRewardsPerShare;

        // mint the pending rewards to the user
        _Token.mint(msg.sender, rewards);

        emit RewardsClaimed(_Epoch.current(), msg.sender, rewards);
    }
}