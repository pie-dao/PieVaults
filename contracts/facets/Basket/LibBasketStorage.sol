// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "../../openzeppelin/token/ERC20/IERC20.sol";

library LibBasketStorage {
    bytes32 constant BASKET_STORAGE_POSITION = keccak256("diamond.standard.basket.storage");

    struct BasketStorage {
        uint256 lockBlock;
        uint256 maxCap;
        IERC20[] tokens;
        mapping(address => bool) inPool;
    }


    function basketStorage() internal pure returns(BasketStorage storage bs) {
        bytes32 position = BASKET_STORAGE_POSITION;
        assembly { bs.slot := position }
    }

}