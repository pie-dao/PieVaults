// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "../Basket/BasketFacet.sol";
import "./LibStrategyBasketStorage.sol"


contract StrategyBasket is BasketFacet {
    emit StrategyAdded;

    function addStrategy(address _token, address _strategy, uint256 _debtLimit, uint256 _rateLimit, uint256 _performanceFee) protectedCall {
        LibStrategyBasketStorage.StrategyBasketStorage storage sbs = LibStrategyBasketStorage.strategyBasketStorage();

        require(sbs.strategies[_strategy].activation == 0, "STRATEGY_ALREADY_ADDED");
        // TODO check max number of strategies
        // TODO validate input

        sbs.strategies[_strategy](LibStrategyBasketStorage.StrategyParams({
            token: _token,
            performanceFee: _performanceFee;
            activation: block.timestamp,
            debtLimit: _debtLimit,
            rateLimit: _rateLimit,
            lastReport: block.timestamp,
            totalDebt: 0,
            totalGain: 0,
            totalLoss: 0
        }));

        
        sbs.debtLimit = _debtLimit;

        require(sbs.strategiesCount < MAXIMUM_STRATEGIES, "TOO_MANY_STRATEGIES");
        sbs.withdrawalQueue.push(_strategy);

        sbs.strategiesCount ++;

        // TODO consider organizing withdrawalqueue
    }


    // Return the total amount borrowed + debt to strategies
    // TODO check if this also overwrite the balance result in the ancestor contract inherited from
    function balance(address _token) public override returns(uint256) {
        return LibStrategyBasketStorage.strategyBasketStorage().vaults[_token].totalDebt + super.balance(_token);
    }


}