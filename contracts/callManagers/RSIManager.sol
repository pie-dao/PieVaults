// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

import "./IPriceReferenceFeed.sol";

contract RSISynthetixManager {

    address public assetA;
    address public assetB;
    bytes32 public assetAKey;
    bytes32 public assetBKey;

    IPriceReferenceFeed public priceFeed;
    address public basket;

    struct RoundData {
        uint80 roundId;
        int256 answer;
        uint256 startedAt; 
        uint256 updatedAt; 
        uint80 answeredInRound;
    }

    constructor(
        address _assetA,
        address _assetB,
        bytes32 _assetAKey,
        bytes32 _assetBKey,
        address _priceFeed,
        address _basket
    ) {
        assetA = _assetA;
        assetB = _assetB;
        assetAKey = _assetAKey;
        assetBKey = _assetBKey;
        priceFeed = IPriceReferenceFeed(_priceFeed);
        basket = _basket;
    }

    function calcRSI(uint256[] memory _rounds) external view returns(uint256) {
        // TODO check validity of rounds in context of calculating RSI

        uint256 totalGain;
        uint256 totalLoss;

        RoundData memory prevRound = readRound(_rounds[0]);

        for(uint256 i = 1; i < _rounds.length; i ++) {
            RoundData memory currentRound = readRound(i);

            // Price went up
            if(currentRound.answer > prevRound.answer) {
                totalGain += currentRound.answer - prevRound.answer;
            } else if(currentRound.answer < prevround.answer) { // price went down
                totalLoss += prevRound.answer - currentRound.answer;
            }

            prevRound = currentRound;
        }
        
        // 100 - (100 / (1 + (totalGain/totalLoss)));
        // TODO check for overflows
        return (100 ** 18) - ((100 ** 18) / (1 + (totalGain / totalLoss)));
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

}