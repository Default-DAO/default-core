// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract Vault is ERC20, Ownable {
    uint8 private _decimals;
    IERC20 private _Asset; // the token that the vault can custody

    constructor(address asset_, string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
        _Asset = IERC20(asset_);
    } 

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    // Deposit assets at the DAO. Get shares in the vaults.
    function deposit(address member_, uint256 depositAmount_) external onlyOwner returns (uint256) {
        uint256 totalAssetsInVault = _Asset.balanceOf(address(this));
        uint256 totalSharesOutstanding = totalSupply();
        uint256 sharesToMint;

        // If there are no shares in existence or no assets in the vault, then issue the same number of shares as assets deposited.
        if (totalSharesOutstanding == 0 || totalAssetsInVault == 0) {
            sharesToMint = depositAmount_;
        } 

        // Calculate and mint the amount of shares the token is worth. The ratio will change overtime, 
        // as token is borrowed/repaid by the DAO. Vault shares decay with the borrow -> deposit -> borrow cycle, so don't
        // expect short term parity between share <-> asset in the vault.
        else {

            // do not use pricePerShare(). This is because we want to perform divisions last
            // in order to to minimize the effects of rounding errors.
            sharesToMint = depositAmount_ * totalSharesOutstanding / totalAssetsInVault;
        }

        // Mint shares to depositor
        _mint(member_, sharesToMint);


        // Lock the tokens in the vault
        _Asset.transferFrom(member_, address(this), depositAmount_);

        // Return the amount of minted shares to the calling contract, in case they want to use it for additional logic.
        return sharesToMint;
    }

    // Open the vault. Return assets to the user and burn their shares of the vault.
    function withdraw(address member_, uint256 totalSharesRedeemed_) external onlyOwner returns (uint256 tokensWithdrawn) {

        uint256 totalAssetsInVault = _Asset.balanceOf(address(this));
        uint256 totalSharesOutstanding = totalSupply();

        require(totalSharesOutstanding > 0, "shares must exist");

        // Integer rounding here should create very slight share surpluses over time (in solidity, int division always rounds down) 
        // e.g. 1 * 1 / 2 = 0
        uint256 amountToWithdraw = totalAssetsInVault * totalSharesRedeemed_ / totalSharesOutstanding;

        // Ensure withdraw can succeed just in case rounding error somehow causes vault to not have enough assets
        if (amountToWithdraw > totalAssetsInVault) { 
            amountToWithdraw = totalAssetsInVault; 
        }

        // Burn the shares redeemed by the user
        _burn(member_, totalSharesRedeemed_);

        // Return the tokens from the vault to the user
        _Asset.transfer(member_, amountToWithdraw);

        return amountToWithdraw;
    }
    
    // restrict share transfers to the OS to prevent secondary markets for vault shares, e.g.
    // letting vault depositors exit without paying the withdraw fee, or borrowing against the shares in lending protocols
    function transfer(address recipient_, uint256 amount_) public override onlyOwner returns (bool) {
        return super.transfer(recipient_, amount_);
    }

    function transferFrom(address sender_, address recipient_, uint256 amount_) public override onlyOwner returns (bool) {
        _transfer(sender_, recipient_, amount_);
        return true;
    }
}
