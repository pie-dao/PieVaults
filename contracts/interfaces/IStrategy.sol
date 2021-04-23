// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
/**
 * This interface is here for the keeper bot to use.
 */
interface IStrategy {
    function name() external view returns (string memory);

    function vault() external view returns (address);

    function want() external view returns (address);

    function apiVersion() external pure returns (string memory);

    function keeper() external view returns (address);

    function isActive() external view returns (bool);

    function delegatedAssets() external view returns (uint256);

    function estimatedTotalAssets() external view returns (uint256);

    function tendTrigger(uint256 callCost) external view returns (bool);

    function tend() external;

    function harvestTrigger(uint256 callCost) external view returns (bool);

    function harvest() external;

    function withdraw(uint256 amount) external returns(uint256);

    event Harvested(uint256 profit, uint256 loss, uint256 debtPayment, uint256 debtOutstanding);
}