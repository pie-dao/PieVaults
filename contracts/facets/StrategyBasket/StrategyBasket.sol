// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
pragma experimental ABIEncoderV2;

import "../Basket/BasketFacet.sol";
import "../Basket/LibBasketStorage.sol";
import "./LibStrategyBasketStorage.sol";
import "../../interfaces/IStrategy.sol";
import "../../interfaces/IStrategyBasketFacet.sol";

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

// TODO change name to match BasketFacet
contract StrategyBasket is BasketFacet, IStrategyBasketFacet {
    using Math for uint256;
    using SafeERC20 for IERC20;

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
    ) protectedCall external override {
        LibStrategyBasketStorage.StrategyBasketStorage storage sbs = LibStrategyBasketStorage.strategyBasketStorage();
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();
        
        // Check if queue is full
        require(sbs.strategiesCount < MAXIMUM_STRATEGIES - 1, "TOO_MANY_STRATEGIES");

        // Check strategy configuration
        require(_token != address(0), "ZERO_TOKEN");
        require(_strategy != address(0), "ZERO_STRATEGY");
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
    ) protectedCall external override {
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
    ) protectedCall external override {
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
    ) protectedCall external override {
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
    ) protectedCall external override {
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
    ) protectedCall external override {
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

    // Hooks
    function _beforeExitPoolUnderlyingTransfer(address _to, IERC20 _token, uint256 _amount) internal virtual override returns(uint256 _amountWithdrawn, uint256 _lossSuffered) {
        // TODO check max loss checking necessary
        LibStrategyBasketStorage.StrategyBasketStorage storage sbs = LibStrategyBasketStorage.strategyBasketStorage();
        LibStrategyBasketStorage.TokenVault storage vault = sbs.vaults[address(_token)];
        address[] storage withdrawalQueue = vault.withdrawalQueue;
        
        uint256 totalLoss = 0;
        // If the vaults balance does not cover the withdrawal
        // TODO consider taking out this if to limt calls. The check is also executed inside of the loop
        if(_amount > _token.balanceOf(address(this))) {
            for(uint256 i = 0; i <  withdrawalQueue.length; i ++) {
                uint256 vaultBalance = _token.balanceOf(address(this));
                // we are done unwinding positions in strategies
                if(vaultBalance >= _amount) {
                    break;
                }

                IStrategy strategy = IStrategy(vault.withdrawalQueue[i]);
                LibStrategyBasketStorage.StrategyParams storage strategyParams = sbs.strategies[address(strategy)];

                // amountNeeded: uint256 = value - vault_balance
                uint256 amountNeeded = _amount - vaultBalance;
                amountNeeded = amountNeeded.min(strategyParams.totalDebt);

                //Nothing to withdraw from this strategy, try the next one
                if(amountNeeded == 0) {
                    continue;
                }

                // # Force withdraw amount from each Strategy in the order set by governance
                // loss: uint256 = Strategy(strategy).withdraw(amountNeeded)
                // withdrawn: uint256 = self.token.balanceOf(self) - vault_balance
                uint256 loss = strategy.withdraw(amountNeeded);
                uint256 withdrawn = _token.balanceOf(address(this)) - vaultBalance;

                if (loss > 0) {
                    // NOTE: Withdrawer incurs any losses from liquidation
                    _amount -= loss;
                    totalLoss += loss;
                    // TODO report loss
                }

                // self.strategies[strategy].totalDebt -= withdrawn
                // self.totalDebt -= withdrawn
                strategyParams.totalDebt -= withdrawn;
                vault.totalDebt -= withdrawn;
            }
        }

        // # NOTE: We have withdrawn everything possible out of the withdrawal queue
        // #       but we still don't have enough to fully pay them back, so adjust
        // #       to the total amount we've freed up through forced withdrawals
        // vault_balance: uint256 = self.token.balanceOf(self)
        uint256 vaultBalance = _token.balanceOf(address(this));

        // if value > vault_balance:
        //     value = vault_balance
        //     # NOTE: Burn # of shares that corresponds to what Vault has on-hand,
        //     #       including the losses that were incurred above during withdrawals
        //     shares = self._sharesForAmount(value + totalLoss)
        // TODO consider calculate exit amount by underlying asset available liquidity

        // NOTE: for now we revert when not enough tokens can be liquidated
        if(_amount > vaultBalance) {
            revert("NOT_ENOUGH_LIQUIDITY");
        }

        return(_amount, totalLoss);
    }

    function report(uint256 _gain, uint256 _loss, uint256 _debtPayment) external returns(uint256) {
        LibStrategyBasketStorage.StrategyBasketStorage storage sbs = LibStrategyBasketStorage.strategyBasketStorage();

        // limit storage reads by caching this value
        address token = sbs.strategies[msg.sender].token;

        LibStrategyBasketStorage.TokenVault storage vault = sbs.vaults[token];
        
        //only approved strategies
        require(sbs.strategies[msg.sender].activation > 0, "STRATEGY_NOT_APPROVED");
        // No lying about available funds
        require(IERC20(token).balanceOf(msg.sender) >= _gain + _debtPayment, "LYING");
        
        // We have a loss to report, do it before the rest of the calculations
        if(_loss > 0) {
            _reportLoss(msg.sender, _loss);
        }

        // Assess both management fee and performance fee, and issue both as shares of the vault
        uint256 totalFees = _assessFees(msg.sender, _gain);

        // Returns are always "realized gains"
        sbs.strategies[msg.sender].totalGain += _gain;

        // Compute the line of credit the Vault is able to offer the Strategy (if any)
        uint256 credit = _creditAvailable(msg.sender);

        // Outstanding debt the Strategy wants to take back from the Vault (if any)
        // NOTE: debtOutstanding <= StrategyParams.totalDebt
        uint256 debt = _debtOutstanding(msg.sender);
        uint256 debtPayment = _debtPayment.min(debt);

        if(debtPayment > 0) {
            sbs.strategies[msg.sender].totalDebt -= debtPayment;
            sbs.vaults[sbs.strategies[msg.sender].token].totalDebt -= debtPayment;
            debt -= debtPayment;
            // NOTE: `debt` is being tracked for later
        }

        // Update the actual debt based on the full credit we are extending to the Strategy
        // or the returns if we are taking funds back
        // NOTE: credit + self.strategies[msg.sender].totalDebt is always < self.debtLimit
        // NOTE: At least one of `credit` or `debt` is always 0 (both can be 0)
        if(credit > 0) {
            sbs.strategies[msg.sender].totalDebt += credit;
            sbs.vaults[token].totalDebt += credit;
        }

        // Give/take balance to Strategy, based on the difference between the reported gains
        // (if any), the debt payment (if any), the credit increase we are offering (if any),
        // and the debt needed to be paid off (if any)
        // NOTE: This is just used to adjust the balance of tokens between the Strategy and
        //       the Vault based on the Strategy's debt limit (as well as the Vault's).
        uint256 totalAvail = _gain + _debtPayment;
        if(totalAvail < credit){  // credit surplus, give to Strategy
            IERC20(token).safeTransfer(msg.sender, credit - totalAvail);
        }
        else if(totalAvail > credit) { // credit deficit, take from Strategy
            IERC20(token).safeTransferFrom(msg.sender, address(this), totalAvail - credit);
        }
        // else, don't do anything because it is balanced

        // Profit is locked and gradually released per block
        // NOTE: compute current locked profit and replace with sum of current and new
        uint256 lockedProfitBeforeLoss = _calculateLockedProfit() + _gain - totalFees;
        if(lockedProfitBeforeLoss > _loss) {
            sbs.vaults[token].lockedProfit = lockedProfitBeforeLoss - _loss;
        } else{
            sbs.vaults[token].lockedProfit = 0;
        }
        // Update reporting time
        sbs.strategies[msg.sender].lastReport = block.timestamp;
        sbs.vaults[token].lastReport = block.timestamp;
        
        // TODO event
        // log StrategyReported(
        //     msg.sender,
        //     gain,
        //     loss,
        //     debtPayment,
        //     self.strategies[msg.sender].totalGain,
        //     self.strategies[msg.sender].totalLoss,
        //     self.strategies[msg.sender].totalDebt,
        //     credit,
        //     self.strategies[msg.sender].debtRatio,
        // )

        if(sbs.strategies[msg.sender].debtRatio == 0 || sbs.vaults[token].emergencyShutdown){
            // Take every last penny the Strategy has (Emergency Exit/revokeStrategy)
            // NOTE: This is different than `debt` in order to extract *all* of the returns
            return IStrategy(msg.sender).estimatedTotalAssets();
        } else {
            // Otherwise, just return what we have as debt outstanding
            return debt;
        }
    }

    function _reportLoss(address _strategy, uint256 _loss) internal {
        LibStrategyBasketStorage.StrategyBasketStorage storage sbs = LibStrategyBasketStorage.strategyBasketStorage();
        // Loss can only be up the amount of debt issued to strategy
        uint256 totalDebt = sbs.strategies[_strategy].totalDebt;
        require(totalDebt >= _loss, "DEBT_TOO_HIGH");

        address token =  sbs.strategies[_strategy].token;

        // Also, make sure we reduce our trust with the strategy by the amount of loss
        if (sbs.vaults[token].debtRatio != 0) { // if vault with single strategy that is set to EmergencyOne
            // NOTE: The context to this calculation is different than the calculation in `_reportLoss`,
            // this calculation intentionally approximates via `totalDebt` to avoid manipulatable results
            //NOTE: This calculation isn't 100% precise, the adjustment is ~10%-20% more severe due to EVM math
            uint256 ratio_change = (_loss * sbs.vaults[token].debtRatio / sbs.vaults[token].totalDebt).min(sbs.strategies[_strategy].debtRatio);
            sbs.strategies[_strategy].debtRatio -= ratio_change;
            sbs.vaults[token].debtRatio -= ratio_change;
        }

        // Finally, adjust our strategy's parameters by the loss
        sbs.strategies[_strategy].totalLoss += _loss;
        sbs.strategies[_strategy].totalDebt = sbs.vaults[token].totalDebt - _loss;
        sbs.strategies[_strategy].totalDebt -= _loss;
    }

    function _assessFees(address _strategy, uint256 _loss) internal returns(uint256) {
        // return mock value
        return 0;

        // NOTE
        // Since Yearn vaults use a single underlying asset it issues new shares to pay for the vault.
        // PieVaults contain multiple asserts so minting shares for performance fees does not work
        // Instead we should send some of the underlying asset to the PieDAO fee receiving address and strategist
    }

    function _creditAvailable(address _strategy) internal returns(uint256) {
        // return mock value
        return 0;
    }

    function _debtOutstanding(address _strategy) internal returns(uint256) {
        // return mock value
        return 0;
    }

    // TODO make this internal vault specific
    function _calculateLockedProfit() internal returns(uint256) {
        return 0;
    }
 
    // Return the total amount borrowed + debt to strategies
    // TODO check if this also overwrite the balance result in the ancestor contract inherited from
    function balance(address _token) public view override returns(uint256) {
        return LibStrategyBasketStorage.strategyBasketStorage().vaults[_token].totalDebt + super.balance(_token);
    }


    function token() external view returns(address) {
        address tokenAddress = LibStrategyBasketStorage.strategyBasketStorage().strategies[msg.sender].token;

        if(tokenAddress == address(0)) {
            tokenAddress = LibStrategyBasketStorage.strategyBasketStorage().nextStrategyToken;
        }

        require(tokenAddress != address(0), "STRATEGY_NOT_ADDED");
        return tokenAddress;
    }

    function getStrategy(address _strategy) external view override returns(LibStrategyBasketStorage.StrategyParams memory) {
        return LibStrategyBasketStorage.strategyBasketStorage().strategies[_strategy];
    }

    function setNextStrategyToken(address _token) protectedCall external override {
        LibStrategyBasketStorage.strategyBasketStorage().nextStrategyToken = _token;
    }

    // expose getter for testing
    function MAX_STRATEGIES() external view override returns(uint256) {
        return MAXIMUM_STRATEGIES;
    }

}