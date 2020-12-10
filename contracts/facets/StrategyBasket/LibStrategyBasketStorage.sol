// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

library LibStrategyBasketStorage {
  bytes32 constant CALL_STORAGE_POSITION = keccak256(
    "diamond.standard.strategy.basket.storage"
  );

  uint256 constant MAXIMUM_STRATEGIES = 20;

  struct StrategyParams {
    address token;
    uint256 performanceFee;
    uint256 activation;
    uint256 debtLimti;
    uint256 rateLimit;
    uint256 lastReport;
    uint256 totalDebt;
    uint256 totalGain;
    uint256 totalLoss;
  }

  struct TokenVault {
    address[] withdrawalQueue; // Ordering that is used when exiting the pool to determin where to withdraw from first
    uint256 depositLimit; // Limit this contract can hold of a token
    uint256 debtLimit; // Amount of tokens all strategies can borrow
    uint256 totalDebt; // Total amount that all strategies have borrowed
    uint256 lastReport; // timestamp of last report
    uint256 activation; // timestamp of when this token was added
  }

  struct BasketStorage {
    mapping(address => StrategyParams) strategies; // strategy address -> StrategyParams
    mapping(address => TokenVault) vaults; // token specific vaults
    uint256 strategiesCount;
  }

  function strategyBasketStorage() internal pure returns (BasketStorage storage sbs) {
    bytes32 position = CALL_STORAGE_POSITION;
    assembly {
      sbs.slot := position
    }
  }
}
