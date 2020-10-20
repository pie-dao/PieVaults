// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {

  constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol){

  }
  function mint(uint256 _amount, address _issuer) external {
    _mint(_issuer, _amount);
  }
}

contract ERC20FactoryContract {
  event TokenCreated(address tokenAddress);

  function deployNewToken(
    string memory _name,
    string memory _symbol,
    uint256 _totalSupply,
    address _issuer
  ) public returns (address) {
    TestToken t = new TestToken(_name, _symbol);
    t.mint(_totalSupply, _issuer);
    emit TokenCreated(address(t));
  }
}
