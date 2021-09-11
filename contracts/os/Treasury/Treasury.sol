// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../DefaultOS.sol";
import "../Epoch/Epoch.sol";
import "./_Vault.sol";

contract def_TreasuryInstaller is DefaultOSModuleInstaller("TSY") {
    string public moduleName = "Default Treasury";

    function install(DefaultOS os_) external override returns (address) {
        def_Treasury treasury = new def_Treasury(os_);
        treasury.transferOwnership(address(os_));
        return address(treasury);
    }
}

contract def_Treasury is DefaultOSModule {

    def_Epoch private _Epoch;

    constructor(DefaultOS os_) DefaultOSModule(os_) {
      _Epoch = def_Epoch(_OS.getModule("EPC"));
    }

    // emitted events
    event VaultOpened(address os, Vault vault, uint16 epochOpened);
    event VaultFeeChanged(address os, Vault vault, uint8 newFee, uint16 epochOpened);
    event Deposited(address os, Vault vault, address member, uint256 amount, uint16 epoch);
    event Withdrawn(address os, Vault vault, address member, uint256 amount, uint16 epoch);

    // token contract => vault contract; ensures only one vault per token
    mapping(address => Vault) public getVault;

    // vault contract => fee charged for vault
    mapping(address => uint8) public vaultFee;

    // **********************************************************************
    //                   OPEN NEW VAULT (GOVERNANCE ONLY)
    // **********************************************************************

    // open a new vault for the treasury (accept deposits for specific token)
    function openVault(address token_, uint8 fee_) external onlyOS {
        // make sure no vault exists for this token
        require(
            address(getVault[token_]) == address(0),
            "vault already exists"
        );
        require(
            fee_ >= 0 && fee_ <= 100,
            "fee must be 0 <= fee <= 100"
        );

        // naming standard for the vault share tokens
        IERC20Metadata _AssetData = IERC20Metadata(token_);
        string memory vaultName = string(
            abi.encodePacked("Default Treasury Vault: ", _AssetData.symbol())
        );
        string memory vaultSymbol = string(
            abi.encodePacked(_AssetData.symbol(), "-VS")
        );
        uint8 vaultDecimals = _AssetData.decimals();

        // create the token contract for this vault
        Vault newVault = new Vault(
            token_,
            vaultName,
            vaultSymbol,
            vaultDecimals
        );

        // save it to the registry        
        getVault[token_] = newVault;
        vaultFee[address(newVault)] = fee_;

        // record event for frontend
        emit VaultOpened(address(_OS), newVault, _Epoch.current());
    }

    // **********************************************************************
    //             WITHDRAW FOR FREE FROM VAULT (GOVERNANCE ONLY)
    // **********************************************************************

    // For the DAO/OS to withdraw earned fees from the vault
    function withdrawFromVault(Vault vault_, uint256 amountshares_)
        external
        onlyOS
    {
        // withdraw from the vault to the OS
        vault_.withdraw(address(_OS), amountshares_);

        emit Deposited(
            address(_OS), 
            vault_,
            address(this),
            amountshares_,
            _Epoch.current()
        );
    }

    // **********************************************************************
    //                   CHANGE VAULT FEE (GOVERNANCE ONLY)
    // **********************************************************************

    function changeFee(Vault vault_, uint8 newFeePctg) external onlyOS {
        require(newFeePctg >= 0 && newFeePctg <= 100);

        // set the fee to the new fee
        vaultFee[address(vault_)] = newFeePctg;

        emit VaultFeeChanged(address(_OS), vault_, newFeePctg, _Epoch.current());
    }

    // **********************************************************************
    //                   DEPOSIT USER FUNDS INTO VAULT
    // **********************************************************************

    function deposit(Vault vault_, uint256 amountTokens_) external {

        // deposit the users funds
        vault_.deposit(msg.sender, amountTokens_);

        emit Deposited(
            address(_OS), 
            vault_,
            msg.sender,
            amountTokens_,
            _Epoch.current()
        );
    }

    // **********************************************************************
    //                   WITHDRAW USER FUNDS FROM VAULT
    // **********************************************************************

    function withdraw(Vault vault_, uint256 amountShares_) external {        
        // calculate the fee collected upon withdraw and transfer shares to the wallet
        uint256 withdrawFeeCollected = (amountShares_ * vaultFee[address(vault_)]) / 100;
        vault_.transferFrom(
            msg.sender,
            address(_OS),
            withdrawFeeCollected
        );

        // use subtraction to avoid rounding errors
        uint256 amountWithdrawn = vault_.withdraw(
            msg.sender,
            amountShares_ - withdrawFeeCollected
        );

        emit Withdrawn(
            address(_OS), 
            vault_,
            msg.sender,
            amountWithdrawn,
            _Epoch.current()
        );
    }
}
