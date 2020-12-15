// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

import "./LendingLogicCompound.sol";

contract LendingLogicCream is LendingLogicCompound {
    constructor(address _lendingRegistry, bytes32 _protocolKey) LendingLogicCompound(_lendingRegistry, _protocolKey) {

    }

    //  Logic is exactly the same as Compound
}