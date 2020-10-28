// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

import "diamond-2/contracts/libraries/LibDiamond.sol";
import "../shared/Reentry/ReentryProtection.sol";
import "../shared/Access/CallProtection.sol";
import "./LibCallStorage.sol";

contract CallFacet is ReentryProtection {

  event CallerAdded(address indexed caller);
  event CallerRemoved(address indexed caller);

  // uses modified call protection modifier to also allow whitelisted addresses to call
  modifier protectedCall() {
    require(
        msg.sender == LibDiamond.diamondStorage().contractOwner ||
        LibCallStorage.callStorage().canCall[msg.sender] ||
        msg.sender == address(this), "NOT_ALLOWED"
    );
    _;
  }

  function addCaller(address _caller) external {
    require(msg.sender == LibDiamond.diamondStorage().contractOwner, "NOT_ALLOWED");
    LibCallStorage.CallStorage storage callStorage = LibCallStorage.callStorage();

    require(!callStorage.canCall[msg.sender], "IS_ALREADY_CALLER");

    callStorage.callers.push(_caller);
    callStorage.canCall[_caller] = true;

    emit CallerAdded(_caller);
  }

  function removeCaller(address _caller) external {
    require(msg.sender == LibDiamond.diamondStorage().contractOwner, "NOT_ALLOWED");
    LibCallStorage.CallStorage storage callStorage = LibCallStorage.callStorage();

    require(callStorage.canCall[msg.sender], "IS_NOT_CALLER");

    for(uint256 i = 0; i < callStorage.callers.length; i ++) {
      address currentCaller = callStorage.callers[i];

      // if found remove it
      if(currentCaller == _caller) {
        callStorage.callers[i] = callStorage.callers[callStorage.callers.length - 1];
        callStorage.callers.pop();
        break;
      }
    }

    emit CallerRemoved(_caller);
  }

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
