// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {

  constructor(string memory name, string memory symbol) ERC20(name, symbol){
    
  }
  function mint(uint256 amount, address issuer) external {
    _mint(issuer, amount);
  }
}

contract ERC20Factory {
  event TokenCreated(address tokenAddress);

  function deployNewToken(
    string memory name,
    string memory symbol,
    uint256 totalSupply,
    address issuer
  ) public returns (address) {
    TestToken t = new TestToken(name, symbol);
    t.mint(totalSupply, issuer);
    emit TokenCreated(address(t));
  }
}
