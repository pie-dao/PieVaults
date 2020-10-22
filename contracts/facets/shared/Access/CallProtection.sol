// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "diamond-3/contracts/libraries/LibDiamond.sol";

contract CallProtection {
    modifier protectedCall() {
        require(
            msg.sender == LibDiamond.diamondStorage().contractOwner ||
            msg.sender == address(this), "NOT_ALLOWED"
        );
        _;
    }
}