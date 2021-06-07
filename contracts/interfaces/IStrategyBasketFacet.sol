// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
pragma experimental ABIEncoderV2;

import "../facets/StrategyBasket/LibStrategyBasketStorage.sol";

interface IStrategyBasketFacet {
    function addStrategy(
        address _token, 
        address _strategy, 
        uint256 _debtRatio, 
        uint256 _minDebtPerHarvest, 
        uint256 _maxDebtPerHarvest,
        uint256 _performanceFee) external;

    function updateStrategyDebtRatio(
        address _strategy,
        uint256 _debtRatio
    ) external;

    function updateStrategyMinDebtPerHarvest(
        address _strategy,
        uint256 _minDebtPerHarvest
    ) external;

    function updateStrategyMaxDebtPerHarvest(
        address _strategy,
        uint256 _maxDebtPerHarvest
    ) external;

    function updateStrategyPerformanceFee(
        address _strategy,
        uint256 _performanceFee
    ) external;

    function revokeStrategy(
        address _strategy
    ) external;

    function setNextStrategyToken(
        address _token
    ) external;

    function getStrategy(
        address _strategy
    ) external view returns(LibStrategyBasketStorage.StrategyParams memory);

    function MAX_STRATEGIES() external view returns(uint256);
}