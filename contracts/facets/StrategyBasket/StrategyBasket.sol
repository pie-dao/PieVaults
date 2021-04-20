// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "../Basket/BasketFacet.sol";
import "../Basket/LibBasketStorage.sol";
import "./LibStrategyBasketStorage.sol";
import "../../interfaces/IStrategy.sol";


contract StrategyBasket is BasketFacet {

    uint256 constant MAXIMUM_STRATEGIES = 20;
    uint256 constant MAX_BPS = 10000; //TODO
    uint256 constant DEGREDATION_COEFFICIENT = 1 ether;

    //emit StrategyAdded;


    /* 
        @notice
            Add a Strategy to the Vault.
            This may only be called by governance.
        @dev
            The Strategy will be appended to `withdrawalQueue`, call
            `setWithdrawalQueue` to change the order.
        @param strategy The address of the Strategy to add.
        @param debtRatio
            The share of the total assets in the `vault that the `strategy` has access to.
        @param minDebtPerHarvest
            Lower limit on the increase of debt since last harvest
        @param maxDebtPerHarvest
            Upper limit on the increase of debt since last harvest
        @param performanceFee
            The fee the strategist will receive based on this Vault's performance.
    */
    function addStrategy(
            address _token, 
            address _strategy, 
            uint256 _debtRatio, 
            uint256 _minDebtPerHarvest, 
            uint256 _maxDebtPerHarvest,
            uint256 _performanceFee
    ) protectedCall external {
        LibStrategyBasketStorage.StrategyBasketStorage storage sbs = LibStrategyBasketStorage.strategyBasketStorage();
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();
        
        // Check if queue is full
        require(sbs.strategiesCount < MAXIMUM_STRATEGIES, "TOO_MANY_STRATEGIES");

        // Check strategy configuration
        require(_token != address(0), "Token cannot be Zero");
        require(_strategy != address(0), "Strategy cannot be Zero");
        require(sbs.strategies[_strategy].activation == 0, "STRATEGY_ALREADY_ADDED");
        require(IStrategy(_strategy).vault() == address(this), "STRATEGY_DOESNT_WORK_IN_VAULT");
        require(IStrategy(_strategy).want() == _token, "STRATEGY_DOESNT_WANT_THE_TOKEN");
        require(bs.inPool[_token], "VAULT_DOESNT_HAVE_TOKEN");

        // Check strategy parameters
        require(sbs.vaults[_token].debtRatio + _debtRatio <= MAX_BPS, "TOO_MUCH_DEBT_FOR_TOKEN");
        require(_minDebtPerHarvest <= _maxDebtPerHarvest, "MINDEBT_OVER_MAXDEBT");
        require(_performanceFee <= (MAX_BPS - sbs.vaults[_token].performanceFee), "TOO_GREEDY");

        // TODO Should we have emergency shutdown for a single asset? How?
        sbs.strategies[_strategy] = LibStrategyBasketStorage.StrategyParams({
            token: _token,
            performanceFee: _performanceFee,
            activation: block.timestamp,
            debtRatio: _debtRatio,
            minDebtPerHarvest: _minDebtPerHarvest,
            maxDebtPerHarvest: _maxDebtPerHarvest,
            lastReport: block.timestamp,
            totalDebt: 0,
            totalGain: 0,
            totalLoss: 0
        });

        // TODO StrategyAdded Event
        sbs.vaults[_token].debtRatio = _debtRatio;
        
        sbs.vaults[_token].withdrawalQueue.push(_strategy);

        // Allows people to always have people to withdraw, because it caps gas usage.
        sbs.strategiesCount ++;

        // TODO consider organizing withdrawalqueue
    }

    /*
    @notice
        Change the quantity of assets `strategy` may manage.
        This may be called by governance or management.
    @param strategy The Strategy to update.
    @param debtRatio The quantity of assets `strategy` may now manage.
    */
    function updateStrategyDebtRatio(
        address _strategy,
        uint256 _debtRatio
    ) protectedCall external {
        LibStrategyBasketStorage.StrategyBasketStorage storage sbs = LibStrategyBasketStorage.strategyBasketStorage();
        require(sbs.strategies[_strategy].activation > 0, "STRATEGY_NOT_ADDED");

        address token = IStrategy(_strategy).want();
        sbs.vaults[token].debtRatio -= sbs.strategies[_strategy].debtRatio;
        sbs.strategies[_strategy].debtRatio = _debtRatio;
        
        sbs.vaults[token].debtRatio += _debtRatio;

        require(sbs.vaults[token].debtRatio <= MAX_BPS, "TOO_MUCH_DEBT_FOR_TOKEN");
        // TODO log StrategyUpdateDebtRatio(strategy, debtRatio)
    }

    /*
    @notice
        Change the quantity assets per block this Vault may deposit to or
        withdraw from `strategy`.
        This may only be called by governance or management.
    @param strategy The Strategy to update.
    @param minDebtPerHarvest
        Lower limit on the increase of debt since last harvest
    */
    function updateStrategyMinDebtPerHarvest(
        address _strategy,
        uint256 _minDebtPerHarvest
    ) protectedCall external {
        LibStrategyBasketStorage.StrategyBasketStorage storage sbs = LibStrategyBasketStorage.strategyBasketStorage();
        require(sbs.strategies[_strategy].activation > 0, "STRATEGY_NOT_ADDED");
        require(sbs.strategies[_strategy].maxDebtPerHarvest > _minDebtPerHarvest, "MAXDEBT_HARVEST > MINDEBT_HARVEST");

        sbs.strategies[_strategy].minDebtPerHarvest = _minDebtPerHarvest;
        // TODO log StrategyUpdateMinDebtPerHarvest(strategy, minDebtPerHarvest)
    }

     /*
    @notice
        Change the quantity assets per block this Vault may deposit to or
        withdraw from `strategy`.
        This may only be called by governance or management.
    @param strategy The Strategy to update.
    @param maxDebtPerHarvest
        Upper limit on the increase of debt since last harvest
    */
    function updateStrategyMaxDebtPerHarvest(
        address _strategy,
        uint256 _maxDebtPerHarvest
    ) protectedCall external {
        LibStrategyBasketStorage.StrategyBasketStorage storage sbs = LibStrategyBasketStorage.strategyBasketStorage();
        require(sbs.strategies[_strategy].activation > 0, "STRATEGY_NOT_ADDED");
        require(sbs.strategies[_strategy].minDebtPerHarvest <= _maxDebtPerHarvest, "MINDEBT_HARVEST <= _maxDebtPerHarvest");

        sbs.strategies[_strategy].maxDebtPerHarvest = _maxDebtPerHarvest;
        // TODO log StrategyUpdateMaxDebtPerHarvest(strategy, maxDebtPerHarvest)
    }

    /*
    @notice
        Change the fee the strategist will receive based on this Vault's
        performance.
        This may only be called by governance.
    @param strategy The Strategy to update.
    @param performanceFee The new fee the strategist will receive.
    */
    function updateStrategyPerformanceFee(
        address _strategy,
        uint256 _performanceFee
    ) protectedCall external {
        LibStrategyBasketStorage.StrategyBasketStorage storage sbs = LibStrategyBasketStorage.strategyBasketStorage();
        require(sbs.strategies[_strategy].activation > 0, "STRATEGY_NOT_ADDED");
        require(sbs.strategies[_strategy].performanceFee <= MAX_BPS, "TOO GREEDY");

        sbs.strategies[_strategy].performanceFee = _performanceFee;
        // TODO log StrategyUpdatePerformanceFee(strategy, performanceFee)
    }

    function _revokeStrategy(
        address _strategy
    ) internal {
        LibStrategyBasketStorage.StrategyBasketStorage storage sbs = LibStrategyBasketStorage.strategyBasketStorage();
        address token = IStrategy(_strategy).want();
        sbs.vaults[token].debtRatio -= sbs.strategies[_strategy].debtRatio;
        sbs.strategies[_strategy].debtRatio = 0;
        // TODO log StrategyRevoked(strategy)
    }

    /*
    @notice
        Revoke a Strategy, setting its debt limit to 0 and preventing any
        future deposits.
        This function should only be used in the scenario where the Strategy is
        being retired but no migration of the positions are possible, or in the
        extreme scenario that the Strategy needs to be put into "Emergency Exit"
        mode in order for it to exit as quickly as possible. The latter scenario
        could be for any reason that is considered "critical" that the Strategy
        exits its position as fast as possible, such as a sudden change in market
        conditions leading to losses, or an imminent failure in an external
        dependency.
        This may only be called by governance, the guardian, or the Strategy
        itself. Note that a Strategy will only revoke itself during emergency
        shutdown.
    @param strategy The Strategy to revoke.
    */
    function revokeStrategy(
        address _strategy
    ) protectedCall external {
        _revokeStrategy(_strategy);
    }

    // TODO
    //function migrateStrategy() {}

    //TODO
    // @external def addStrategyToQueue(strategy: address):

    //TODO
    // @external def removeStrategyFromQueue (strategy: address):

    //TODO
    // @view @external def debtOutstanding(strategy: address = msg.sender) -> uint256:


    // Return the total amount borrowed + debt to strategies
    // TODO check if this also overwrite the balance result in the ancestor contract inherited from
    function balance(address _token) public view override returns(uint256) {
        return LibStrategyBasketStorage.strategyBasketStorage().vaults[_token].totalDebt + super.balance(_token);
    }


}