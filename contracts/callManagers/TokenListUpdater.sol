// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IExperiPie.sol";

contract TokenListUpdater is Ownable, ReentrancyGuard {

    modifier ownerOrPie(address _pie) {
        require(msg.sender == owner() ||
        msg.sender == _pie, "Not allowed");
        _;
    }

    uint256 public constant MIN_AMOUNT = 10**6;

    function update(address _pie, address[] calldata _tokens) ownerOrPie(_pie) nonReentrant external {
        IExperiPie pie = IExperiPie(_pie);

        for(uint256 i = 0; i < _tokens.length; i ++) {
            uint256 tokenBalance = pie.balance(_tokens[i]);
            
            if(tokenBalance >= MIN_AMOUNT && !pie.getTokenInPool(_tokens[i])) {
                //if min amount reached and not already in pool
                bytes memory data = abi.encodeWithSelector(pie.addToken.selector, _tokens[i]);
                pie.singleCall(address(pie), data, 0);
            } else if(tokenBalance < MIN_AMOUNT && pie.getTokenInPool(_tokens[i])) {
                // if smaller than min amount and in pool
                bytes memory data = abi.encodeWithSelector(pie.removeToken.selector, _tokens[i]);
                pie.singleCall(address(pie), data, 0);
            }
        }        
    }

}