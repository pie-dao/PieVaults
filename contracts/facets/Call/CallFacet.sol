// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

import "../../diamond-3/contracts/libraries/LibDiamondStorage.sol";
import "../Reentry/ReentryProtectionFacet.sol";

contract CallFacet is ReentryProtectionFacet {
    function call(address[] memory _targets, bytes[] memory _calldata, uint256[] memory _values) external noReentry {
        // ONLY THE OWNER CAN DO ARBITRARY CALLS
        require(msg.sender == LibDiamondStorage.diamondStorage().contractOwner);
        require(_targets.length == _calldata.length && _values.length == _calldata.length, "ARRAY_LENGTH_MISMATCH");

        for(uint256 i = 0; i < _targets.length; i ++) {
            // address(test).call{value: 1}(abi.encodeWithSignature("nonExistingFunction()"))
            (bool success, ) = _targets[i].call{value: _values[i]}(_calldata[i]);
            require(success, "CALL_FAILED");
        }
    }
}