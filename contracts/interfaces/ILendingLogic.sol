// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

interface ILendingLogic {
    function lend(address _underlying, uint256 _amount) external returns(address[] memory targets, bytes[] memory data);
    function unlend(address _underlying, uint256 _amount) external returns(address[] memory targets, bytes[] memory data);
}