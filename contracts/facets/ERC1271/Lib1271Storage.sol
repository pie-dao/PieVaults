// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

library LibERC1271Storage {

  bytes32 constant ERC_1271_STORAGE_POSITION = keccak256(
    // Compatible with pie-smart-pools
    "ERC1271.storage.location"
  );

  struct ERC1271Storage {
    mapping(bytes32 => bool) isApproved;
    mapping(address => bool) isSigner;
    address[] signers;
  }

  function erc1271Storage() internal pure returns (ERC1271Storage storage es) {
    bytes32 position = ERC_1271_STORAGE_POSITION;
    assembly {
      es.slot := position
    }
  }
}
