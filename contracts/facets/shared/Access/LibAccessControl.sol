// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

library LibAccessControl {
  bytes32 constant ACCESS_CONTROL_STORAGE_POSITION = keccak256(
    "diamond.standard.accesscontrol.storage"
  );

  struct AccessControlStorage {
      bool blacklistControlEnabled; // if false, blacklist protection is on 
      bool contractAccessControlEnabled; // if false, contract access protection is on (only eoa can call)

      mapping(address => bool) isBlacklisted; // if address entry is true, the address is blacklisted
  }

  function accessControlStorage() internal pure returns (AccessControlStorage storage acs) {
    bytes32 position = ACCESS_CONTROL_STORAGE_POSITION;

    assembly {
      acs.slot := position
    }
  }
}