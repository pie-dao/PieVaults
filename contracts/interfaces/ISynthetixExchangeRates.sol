// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

interface ISynthetixExchangeRates {
    function rateForCurrency(bytes32 currencyKey) external view returns (uint);
    function rateIsStale(bytes32 currencyKey) external view returns (bool);
    function rateStalePeriod() external view returns (uint);
    function ratesForCurrencies(bytes32[] calldata currencyKeys) external view returns (uint[] memory);
}