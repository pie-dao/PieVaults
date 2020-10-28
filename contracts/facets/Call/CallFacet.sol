// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

import "diamond-2/contracts/libraries/LibDiamond.sol";
import "../shared/Reentry/ReentryProtection.sol";
import "../shared/Access/CallProtection.sol";

contract CallFacet is ReentryProtection, CallProtection {
  function call(
    address[] memory _targets,
    bytes[] memory _calldata,
    uint256[] memory _values
  ) external noReentry protectedCall {
    require(
      _targets.length == _calldata.length && _values.length == _calldata.length,
      "ARRAY_LENGTH_MISMATCH"
    );

    for (uint256 i = 0; i < _targets.length; i++) {
      (bool success, ) = _targets[i].call{ value: _values[i] }(_calldata[i]);
      require(success, "CALL_FAILED");
    }
  }
}
