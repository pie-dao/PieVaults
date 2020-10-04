// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
pragma experimental ABIEncoderV2;

import "../diamond-3/contracts/Diamond.sol";

contract DiamondFactory {
    event DiamondCreated(address tokenAddress);

    function deployNewDiamond(address _owner, IDiamondCut.FacetCut[][] memory diamondCut)
    public returns (address) {
        for (uint256 i = 0; i < diamondCut.length; i++){
            Diamond d = new Diamond(_owner, diamondCut[i]);
            emit DiamondCreated(address(d));
        }
    }
}