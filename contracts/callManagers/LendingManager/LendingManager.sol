// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "./LendingRegistry.sol";
import "../../interfaces/IExperiPie.sol";

contract LendingManager is Ownable {
    using Math for uint256;

    LendingRegistry public lendingRegistry;
    IExperiPie public basket;

    constructor(address _lendingRegistry, address _basket) public {
        lendingRegistry = LendingRegistry(_lendingRegistry);
        basket = IExperiPie(_basket);
    }

    function lend(address _underlying, uint256 _amount, bytes32 _protocol) public onlyOwner {
        // _amount or actual balance, whatever is less
        uint256 amount = _amount.min(IERC20(_underlying).balanceOf(address(basket)));

        //lend token
        (
            address[] memory _targets,
            bytes[] memory _data
        ) = lendingRegistry.getLendTXData(_underlying, amount, _protocol);

        basket.callNoValue(_targets, _data);

        // if needed remove underlying from basket
        removeToken(_underlying);

        // add wrapped token
        addToken(lendingRegistry.underlyingToProtocolWrapped(_underlying, _protocol));
    }

    function unlend(address _wrapped, uint256 _amount) public onlyOwner {
        // unlend token
         // _amount or actual balance, whatever is less
        uint256 amount = _amount.min(IERC20(_wrapped).balanceOf(address(basket)));

        //Unlend token
        (
            address[] memory _targets,
            bytes[] memory _data
        ) = lendingRegistry.getUnlendTXData(_wrapped, amount);
        basket.callNoValue(_targets, _data);

        // if needed add underlying
        addToken(lendingRegistry.wrappedToUnderlying(_wrapped));

        // if needed remove wrapped
        removeToken(_wrapped);
    }

    function bounce(address _wrapped, uint256 _amount, bytes32 _toProtocol) external {
       unlend(_wrapped, _amount);
       // Bounce all to new protocol
       lend(lendingRegistry.wrappedToUnderlying(_wrapped), uint256(-1), _toProtocol);
    }

    function removeToken(address _token) internal {
        uint256 balance = basket.balance(_token);
        bool inPool = basket.getTokenInPool(_token);
        //if there is a token balance of the token is not in the pool, skip
        if(balance != 0 || !inPool) {
            return;
        }

        // remove token
        basket.singleCall(address(basket), abi.encodeWithSelector(basket.removeToken.selector, _token), 0);
    }

    function addToken(address _token) internal {
        uint256 balance = basket.balance(_token);
        bool inPool = basket.getTokenInPool(_token);
        // If token has no balance or is already in the pool, skip
        if(balance == 0 || inPool) {
            return;
        }

        // add token
        basket.singleCall(address(basket), abi.encodeWithSelector(basket.addToken.selector, _token), 0);
    }
 
}