// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "../../openzeppelin/math/SafeMath.sol";
import "../ERC20/LibERC20Storage.sol";
import "../ERC20/LibERC20.sol";
import "./LibBasketStorage.sol";
import "../../diamond-3/contracts/libraries/LibDiamondStorage.sol";
import "../Reentry/ReentryProtectionFacet.sol";

contract BasketFacet is ReentryProtectionFacet {
    using SafeMath for uint256;

    uint256 constant MIN_AMOUNT = 1 gwei;

    // Before calling the first joinPool, the pools needs to be initialized with token balances
    function initialize(address[] memory _tokens, uint256 _maxCap) external noReentry {
        LibDiamondStorage.DiamondStorage storage ds = LibDiamondStorage.diamondStorage();
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();
        LibERC20Storage.ERC20Storage storage es = LibERC20Storage.erc20Storage();

        require(msg.sender == ds.contractOwner, "Must own the contract.");
        require(es.totalSupply >= MIN_AMOUNT, "POOL_TOKEN_BALANCE_TOO_LOW");
        require(es.totalSupply <= _maxCap, "MAX_POOL_CAP_REACHED");

        for (uint256 i = 0; i < _tokens.length; i ++) {
            bs.tokens.push(IERC20(_tokens[i]));
            bs.inPool[_tokens[i]] = true;
            // requires some initial supply, could be less than 1 gwei, but yea.
            require(balance(_tokens[i]) >= MIN_AMOUNT, "TOKEN_BALANCE_TOO_LOW");
        }

        // unlock the contract
        this.setMaxCap(_maxCap);
        this.setLock(block.number.sub(1));
    }

    function joinPool(uint256 _amount) external noReentry {
        require(!this.getLock(), "POOL_LOCKED");
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();
        uint256 totalSupply = LibERC20Storage.erc20Storage().totalSupply;
        require(totalSupply.add(_amount) < this.getMaxCap(), "MAX_POOL_CAP_REACHED");

        for(uint256 i; i < bs.tokens.length; i ++) {
            IERC20 token = bs.tokens[i];
            uint256 tokenAmount = balance(address(token)).mul(_amount).div(totalSupply);
            require(token.transferFrom(msg.sender, address(this), tokenAmount), "Transfer Failed");
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
            require(token.transfer(msg.sender, tokenAmount), "Transfer Failed");
        }

        require(totalSupply.sub(_amount) >= MIN_AMOUNT, "POOL_TOKEN_BALANCE_TOO_LOW");
        LibERC20.burn(msg.sender, _amount);
    }

    // returns true when locked
    function getLock() external view returns(bool){
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();
        return bs.lockBlock == 0 || bs.lockBlock >= block.number;
    }

    // lock up to and including _lock blocknumber
    function setLock(uint256 _lock) external {
        // Maybe remove the first check
        require(
            msg.sender == LibDiamondStorage.diamondStorage().contractOwner ||
            msg.sender == address(this), "NOT_ALLOWED"
        );
        LibBasketStorage.basketStorage().lockBlock = _lock;
    }

    function getMaxCap() external view returns(uint256){
        return LibBasketStorage.basketStorage().maxCap;
    }

    function setMaxCap(uint256 _maxCap) external returns(uint256){
        require(
            msg.sender == LibDiamondStorage.diamondStorage().contractOwner ||
            msg.sender == address(this), "NOT_ALLOWED"
        );
        LibBasketStorage.basketStorage().maxCap = _maxCap;
    }

    // Seperated balance function to allow yearn like strategies to be hooked up by inheriting from this contract and overriding
    function balance(address _token) public view returns(uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    function getTokens() external view returns (IERC20[] memory) {
        return(LibBasketStorage.basketStorage().tokens);
    }

}