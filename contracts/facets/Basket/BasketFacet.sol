// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../ERC20/LibERC20Storage.sol";
import "../ERC20/LibERC20.sol";
import "./LibBasketStorage.sol";
import "../shared/Reentry/ReentryProtection.sol";
import "../shared/Access/CallProtection.sol";

contract BasketFacet is ReentryProtection, CallProtection {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 constant MIN_AMOUNT = 10**6;

    function addToken(address _token) external protectedCall {
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();
        require(!bs.inPool[_token], "TOKEN_ALREADY_IN_POOL");
        // Enforce minimum to avoid rounding errors; (Minimum value is the same as in Balancer)
        require(balance(_token) >= MIN_AMOUNT, "BALANCE_TOO_SMALL");

        bs.inPool[_token] = true;
        bs.tokens.push(IERC20(_token));
    }

    function removeToken(address _token) external protectedCall {
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();

        require(bs.inPool[_token], "TOKEN_NOT_IN_POOL");

        bs.inPool[_token] = false;

        // remove token from array
        // TODO consider limiting max amount of tokens to mitigate running out of gas.
        for(uint256 i; i < bs.tokens.length; i ++) {
            if(address(bs.tokens[i]) == _token) {
                bs.tokens[i] = bs.tokens[bs.tokens.length - 1];
                bs.tokens.pop();

                break;
            }
        }
    }

    function joinPool(uint256 _amount) external noReentry {
        require(!this.getLock(), "POOL_LOCKED");
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();
        uint256 totalSupply = LibERC20Storage.erc20Storage().totalSupply;
        require(totalSupply.add(_amount) < this.getCap(), "MAX_POOL_CAP_REACHED");

        for(uint256 i; i < bs.tokens.length; i ++) {
            IERC20 token = bs.tokens[i];
            uint256 tokenAmount = balance(address(token)).mul(_amount).div(totalSupply);
            require(tokenAmount != 0, "AMOUNT_TOO_SMALL");
            token.safeTransferFrom(msg.sender, address(this), tokenAmount);
        }

        LibERC20.mint(msg.sender, _amount);
    }


    // Must be overwritten to withdraw from strategies
    function exitPool(uint256 _amount) external virtual noReentry {
        require(!this.getLock(), "POOL_LOCKED");
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();
        uint256 totalSupply = LibERC20Storage.erc20Storage().totalSupply;

        for(uint256 i; i < bs.tokens.length; i ++) {
            IERC20 token = bs.tokens[i];
            uint256 balance = balance(address(token));
            uint256 tokenAmount = balance.mul(_amount).div(totalSupply);
            require(balance.sub(tokenAmount) >= MIN_AMOUNT, "TOKEN_BALANCE_TOO_LOW");
            token.safeTransfer(msg.sender, tokenAmount);
        }

        require(totalSupply.sub(_amount) >= MIN_AMOUNT, "POOL_TOKEN_BALANCE_TOO_LOW");
        LibERC20.burn(msg.sender, _amount);
    }

    // returns true when locked
    function getLock() external view returns(bool) {
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();
        return bs.lockBlock == 0 || bs.lockBlock >= block.number;
    }

    function getTokenInPool(address _token) external view returns(bool) {
        return LibBasketStorage.basketStorage().inPool[_token];
    }

    function getLockBlock() external view returns(uint256) {
        return LibBasketStorage.basketStorage().lockBlock;
    }

    // lock up to and including _lock blocknumber
    function setLock(uint256 _lock) external protectedCall {
        LibBasketStorage.basketStorage().lockBlock = _lock;
    }

    function getCap() external view returns(uint256){
        return LibBasketStorage.basketStorage().maxCap;
    }

    function setCap(uint256 _maxCap) external protectedCall returns(uint256){
        LibBasketStorage.basketStorage().maxCap = _maxCap;
    }

    // Seperated balance function to allow yearn like strategies to be hooked up by inheriting from this contract and overriding
    function balance(address _token) public view returns(uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    function getTokens() external view returns (address[] memory result) {
        IERC20[] memory tokens = LibBasketStorage.basketStorage().tokens;
        result = new address[](tokens.length);

        for(uint256 i = 0; i < tokens.length; i ++) {
            result[i] = address(tokens[i]);
        }

        return(result);
    }

    function calcTokensForAmount(uint256 _amount) external view returns (address[] memory tokens, uint256[] memory amounts) {
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();
        uint256 totalSupply = LibERC20Storage.erc20Storage().totalSupply;

        tokens = new address[](bs.tokens.length);
        amounts = new uint256[](bs.tokens.length);

        for(uint256 i; i < bs.tokens.length; i ++) {
            IERC20 token = bs.tokens[i];
            uint256 balance = balance(address(token));
            uint256 tokenAmount = balance.mul(_amount).div(totalSupply);
            
            tokens[i] = address(token);
            amounts[i] = tokenAmount;
        }

        return(tokens, amounts);
    }

}