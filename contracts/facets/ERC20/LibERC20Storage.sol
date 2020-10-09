// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

library LibERC20Storage {
  bytes32 constant ERC_20_STORAGE_POSITION = keccak256(
    "diamond.standard.erc20.storage"
  );

  struct ERC20Storage {
    mapping(address => uint256) balances;
    mapping(address => mapping(address => uint256)) allowances;
    uint256 totalSupply;
    string name;
    string symbol;
    uint8 decimals;
  }

  function erc20Storage() internal pure returns (ERC20Storage storage es) {
    bytes32 position = ERC_20_STORAGE_POSITION;
    assembly {
      es.slot := position
    }
  }
}
