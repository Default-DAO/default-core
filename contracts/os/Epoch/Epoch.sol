// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../DefaultOS.sol";
import "../Token/Token.sol";

/// @title Installer for Epoch module (EPC)
/// @notice Factory contract for the Epoch module
contract def_EpochInstaller is DefaultOSModuleInstaller("EPC") {

  string public moduleName = "Epoch";

  /// @notice Install Epoch module on a DAO 
  /// @param os_ Instance of DAO OS
  /// @return address Address of Epoch module instance
  function install(DefaultOS os_) external override returns (address) {
      def_Epoch epoch = new def_Epoch(os_);
      epoch.transferOwnership(address(os_)); 
      return address(epoch);
  }
}

/// @title Epoch Module (EPC)
/// @notice Instance of Epoch module. Epoch allows DAO to keep track of weekly intervals, and mints new ERC20 tokens at the end of each interval
/// @dev In the future, Epoch module may allow DAO to set their own internal lengths (months, biweekly, etc)
contract def_Epoch is DefaultOSModule {
  
  // module configuration
  def_Token private _Token;

  /// @notice Set address of ERC20 token module (DKN) of DAO in state
  /// @param os_ Instance of DAO OS
  constructor(DefaultOS os_) DefaultOSModule(os_) {
    _Token = def_Token(_OS.getModule("TKN"));
  }

  // emitted events
  event EpochIncremented(uint16 currentEpoch, uint256 epochTime);

  uint16 public current = 1;
  uint256 public epochTime = block.timestamp;
  uint256 public TOKEN_BONUS = 5000;

  /// @notice Set amount of tokens that will be minted at the end of each epoch
  /// @param newTokenBonus_ Amount of tokens to be minted each epoch
  function setTokenBonus(uint256 newTokenBonus_) external onlyOS {
    TOKEN_BONUS = newTokenBonus_;
  }

  /// @notice Once 7 days have passed from the start of the last epoch, start a new epoch and mint new tokens
  function incrementEpoch() external {        
    require(block.timestamp >= epochTime + (7 days), "def_Epoch | incrementEpoch(): cannot increment epoch before deadline");
    epochTime = block.timestamp;
    current++;

    _Token.mint(msg.sender, TOKEN_BONUS);
    emit EpochIncremented(current, epochTime);
  }    
}