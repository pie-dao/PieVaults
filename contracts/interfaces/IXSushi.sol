// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

interface ICToken {
    function enter(uint256 _amount) external;
    function leave(uint256 _share) external;
}