// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "./CallProtection.sol";
import "./LibAccessControl.sol";

contract AccessControl is CallProtection {
    modifier onlyAllowed() {
        LibAccessControl.AccessControlStorage storage s = LibAccessControl.accessControlStorage();

        if (s.contractAccessControlEnabled) {
            require(tx.origin == msg.sender, "onlyEOA: ONLY_EOA_ALLOWED");
        }

        if (s.blacklistControlEnabled) {
            require(!s.isBlacklisted[msg.sender], "onlyEOA: BLACKLISTED");
        }

        _;
    }

    event Blacklisted(address indexed who, bool blacklist);

    function setBlacklisted(address who, bool blacklist) external protectedCall {
        LibAccessControl.AccessControlStorage storage s = LibAccessControl.accessControlStorage();
        s.isBlacklisted[who] = blacklist;

        emit Blacklisted(who, blacklist);
    }

    event AccessControlChanged(bool contractAccess, bool blacklist);

    function setAccessControl(bool contractAccess, bool blacklist) external protectedCall {
        LibAccessControl.AccessControlStorage storage s = LibAccessControl.accessControlStorage();
        s.contractAccessControlEnabled = blacklist;
        s.blacklistControlEnabled = blacklist;

        emit AccessControlChanged(contractAccess, blacklist);
    }
}
