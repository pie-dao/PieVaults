// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library LibBufferStorage {
    bytes32 constant BUFFER_STORAGE_POSITION = keccak256(
        "diamond.standard.buffer.storage"
    );
    struct BufferStorage {
        mapping(address => uint256) bufferAmount;
        mapping(address => uint256) bufferMax ;
        address exchangeRates;
    }

    function bufferStorage() internal pure returns (BufferStorage storage bs) {
        bytes32 position = BUFFER_STORAGE_POSITION;
        assembly {
        bs.slot := position
        }
    }
}