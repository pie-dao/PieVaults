// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

import "../interfaces/ISynthetix.sol";
import "../interfaces/IExperiPie.sol";
import "../interfaces/IPriceReferenceFeed.sol";

contract RSISynthetixManager {

    address public immutable assetShort;
    address public immutable assetLong;
    bytes32 public immutable assetShortKey;
    bytes32 public immutable assetLongKey;

    IPriceReferenceFeed public immutable priceFeed;
    IExperiPie public immutable basket;
    ISynthetix public immutable synthetix;

    struct RoundData {
        uint80 roundId;
        int256 answer;
        uint256 startedAt; 
        uint256 updatedAt; 
        uint80 answeredInRound;
    }

    constructor(
        address _assetShort,
        address _assetLong,
        bytes32 _assetShortKey,
        bytes32 _assetLongKey,
        address _priceFeed,
        address _basket,
        address _synthetix
    ) {
        assetShort = _assetShort;
        assetLong = _assetLong;
        assetShortKey = _assetShortKey;
        assetLongKey = _assetLongKey;
        priceFeed = IPriceReferenceFeed(_priceFeed);
        basket = IExperiPie(_basket);
        synthetix = ISynthetix(_synthetix);
    }


    function rebalance() external {
        RoundData memory roundData = readLatestRound();
        require(roundData.updatedAt > 0, "Round not complete");

        if(roundData.answer <= 30 * 10**18) {
            // long
            long();
        } else if(roundData.answer >= 70 * 10**18) {
            // Short
            short();
        }
    }

    function long() internal {
        IERC20 currentToken = IERC20(getCurrentToken());
        require(address(currentToken) == assetShort, "Can only long when short");

        uint256 currentTokenBalance = currentToken.balanceOf(address(basket));

        address[] memory targets = new address[](4);
        bytes[] memory data = new bytes[](4);
        uint256[] memory values = new uint256[](4);

        // lock pool
        targets[0] = address(basket);
        // lock for 30
        data[0] = setLockData(block.number + 30);

        // Swap on synthetix
        targets[1] = address(synthetix);
        data[1] = abi.encodeWithSelector(synthetix.exchange.selector, assetShortKey, currentTokenBalance, assetLongKey);


        // Remove current token
        targets[2] = address(basket);
        data[2] = abi.encodeWithSelector(basket.removeToken.selector, assetShort);

        // Add new token
        targets[3] = address(basket);
        data[3] = abi.encodeWithSelector(basket.addToken.selector, assetLong);

        // Do calls
        basket.call(targets, data, values);
    }

    function short() internal {
        IERC20 currentToken = IERC20(getCurrentToken());
        require(address(currentToken) == assetLong, "Can only short when long");

        uint256 currentTokenBalance = currentToken.balanceOf(address(basket));

        address[] memory targets = new address[](4);
        bytes[] memory data = new bytes[](4);
        uint256[] memory values = new uint256[](4);

        // lock pool
        targets[0] = address(basket);
        // lock for 30
        data[0] = setLockData(block.number + 30);

        // Swap on synthetix
        targets[1] = address(synthetix);
        data[1] = abi.encodeWithSelector(synthetix.exchange.selector, assetLongKey, currentTokenBalance, assetShortKey);


        // Remove current token
        targets[2] = address(basket);
        data[2] = abi.encodeWithSelector(basket.removeToken.selector, assetLong);

        // Add new token
        targets[3] = address(basket);
        data[3] = abi.encodeWithSelector(basket.addToken.selector, assetShort);

        // Do calls
        basket.call(targets, data, values);
    }

    function getCurrentToken() public view returns(address) {
        address[] memory tokens = basket.getTokens();
        require(tokens.length == 1, "RSI Pie can only have 1 asset at the time");
        return tokens[0];
    }


    function setLockData(uint256 _block) internal returns(bytes memory data) {
        bytes memory data = abi.encodeWithSelector(basket.setLock.selector, _block);
        return data;
    }
    function readRound(uint256 _round) public view returns(RoundData memory data) {
        (
            uint80 roundId, 
            int256 answer, 
            uint256 startedAt, 
            uint256 updatedAt, 
            uint80 answeredInRound
        ) = priceFeed.getRoundData(uint80(_round));

        return RoundData({
            roundId: roundId,
            answer: answer,
            startedAt: startedAt,
            updatedAt: updatedAt,
            answeredInRound: answeredInRound
        });
    }

    function readLatestRound() public view returns(RoundData memory data) {
        (
            uint80 roundId, 
            int256 answer, 
            uint256 startedAt, 
            uint256 updatedAt, 
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        return RoundData({
            roundId: roundId,
            answer: answer,
            startedAt: startedAt,
            updatedAt: updatedAt,
            answeredInRound: answeredInRound
        });
    }

}