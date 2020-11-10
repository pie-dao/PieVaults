// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
pragma experimental ABIEncoderV2;

interface ICallFacet {
    function call(
        address[] memory _targets,
        bytes[] memory _calldata,
        uint256[] memory _values
    ) external;

    function callNoValue(
        address[] memory _targets,
        bytes[] memory _calldata
    ) external;

    function singleCall(
        address _target,
        bytes calldata _calldata,
        uint256 _value
    ) external;

    function addCaller(address _caller) external;

    function removeCaller(address _caller) external;

    function canCall(address _caller) external view returns (bool);

    function getCallers() external view returns (address[] memory);
}