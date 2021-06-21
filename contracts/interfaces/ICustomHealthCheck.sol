// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

interface ICustomHealthCheck {
    function check(uint256 _profit, uint256 _loss, address _callerStrategy) external view returns(bool);
}