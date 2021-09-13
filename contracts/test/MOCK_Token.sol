// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20("Test Token", "USDC") {
    function mint(address member_, uint256 amount_) external {      
      _mint(member_, amount_);
    }
}
