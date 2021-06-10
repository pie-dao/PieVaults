// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

library LibStrategyBasketStorage {
  bytes32 constant CALL_STORAGE_POSITION = keccak256(
    "diamond.standard.strategy.basket.storage"
  );

  struct StrategyParams {
    address token;
    uint256 performanceFee; // Strategist's fee (basis points)
    uint256 activation; // Activation block.timestamp
    uint256 debtRatio; // Maximum borrow amount (in BPS of total assets)
    uint256 minDebtPerHarvest; // Lower limit on the increase of debt since last harvest
    uint256 maxDebtPerHarvest; // Upper limit on the increase of debt since last harvest
    uint256 lastReport; // block.timestamp of the last time a report occured
    uint256 totalDebt; // Total outstanding debt that Strategy has
    uint256 totalGain; // Total returns that Strategy has realized for Vault
    uint256 totalLoss; // Total losses that Strategy has realized for Vault
  }

  struct TokenVault {
    address[] withdrawalQueue; // Ordering that is used when exiting the pool to determin where to withdraw from first
    uint256 depositLimit; // Limit this contract can hold of a token
    uint256 debtLimit; // Amount of tokens all strategies can borrow
    uint256 debtRatio; // Debt ratio for the Vault across all strategies (in BPS, <= 10k)
    uint256 totalDebt; // Total amount that all strategies have borrowed
    uint256 lastReport; // timestamp of last report
    uint256 activation; // timestamp of when this token was added
    uint256 performanceFee; // Vault fee (basis points)
    uint256 lockedProfit;  // how much profit is locked and cant be withdrawn
    bool emergencyShutdown;
    uint256 lockedProfitDegradation;
  }

  struct StrategyBasketStorage {
    mapping(address => StrategyParams) strategies; // strategy address -> StrategyParams
    mapping(address => TokenVault) vaults; // token specific vaults
    uint256 strategiesCount;
    address nextStrategyToken;
  }

  function strategyBasketStorage() internal pure returns (StrategyBasketStorage storage sbs) {
    bytes32 position = CALL_STORAGE_POSITION;
    assembly {
      sbs.slot := position
    }
  }
}
