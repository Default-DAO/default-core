// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../DefaultOS.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

/// @title Installer for Token module (TKN)
/// @notice Factory contract for the ERC20 Token Module
contract def_TokenInstaller is DefaultOSModuleInstaller("TKN") {
    string public moduleName = "DefaultOS ERC20 Token";

  /// @notice Install Token module on a DAO 
  /// @return address Address of Token module instance
  /// @dev install() is called by the DAO contract
    function install() external override returns (address) {
        def_Token token = new def_Token(DefaultOS(msg.sender));
        token.transferOwnership(msg.sender); 
        return address(token);
    }
}

/// @title Token module (TKN)
/// @notice Instance of Token module. 
/// @dev Tokens set to three decimals
contract def_Token is DefaultOSModule, ERC20("Default Token", "DEF") {

    // 3 decimals
    uint8 private _decimals = 3;

    constructor(DefaultOS os_) DefaultOSModule(os_) {}


    /// @notice Mint new tokens and assign them to member address
    /// @param member_ Address of member
    /// @param amount_ Number of tokens to transfer
    function mint(address member_, uint256 amount_) external { // onlyOS("MINTER") -> an OS-whitelist of all the tokens that have the ability to call this function
        _mint(member_, amount_);
    }

    /// @notice Decimals used for displaying the contract
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}