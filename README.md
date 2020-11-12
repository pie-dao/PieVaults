## Description

ExperiPie (TPIE++) is a new pool design with unlimited possibilities. The ExperiPie is based on the Diamond standard, this standard ensures contracts can grow beyond their restricted size. ([extra info](https://dev.to/mudgen/ethereum-s-maximum-contract-size-limit-is-solved-with-the-diamond-standard-2189))

## Motivation
There are basically two motivations, governance participation and yield farming.

In the current DeFi space there are lot’s of opportunities to participate in governance of various protocols. The ExperiPie uses a very flexible CallFacet which makes it possible to execute any call on behalf of the pool. The ExperiPie will be used to participate in governance protocols to benefit PieDao participants.

Yield farm opportunities can show up any time, not everyone has the liquidity or attention to fulfill every opportunity. Using the ExperiPie everyone can pool their tokens. Through the flexible nature of the pool it is possible to use active governance to take any yield farm opportunity.

See the [forum post](https://forum.piedao.org/t/pool-experipie/210) for more information.

Depends on

https://github.com/mudgen/diamond-2


## Call Managers

CallManagers are addresses which are whitelisted to trigger arbitrary calls from the ExperiPie. A whitelisted caller can be added by calling `addCaller(_newCaller)` on the ExperiPie from the contract owner. ⚠️ This should be used with caution as it allows any token within an ExperiPie to be pulled out ⚠️. Only trusted addresses or smart contracts should be added as callers.

### Lending Manager

The `lendingManager` allows the owner of that instance to withdraw and deposit tokens into lending lending protocols which are whitelisted in the `lendingRegistry`. The owner of the `lendingManager` instance can move tokens between whitelisted lending protocols in the `lendingRegistry`.

For a lending manager to be able to manage a ExperiPie's tokens it needs to be whitelisted as a caller.

The owner of the lending manager instance can `lend`, `unlend` and `bounce`(hopping between protocols).

These functions have the following interface and should be called on the Lending Manager contract.

```solidity
/**
    @notice Move underlying to a lending protocol
    @param _underlying Address of the underlying token
    @param _amount Amount of underlying to lend
    @param _protocol Bytes32 protocol key to lend to
*/
    function lend(address _underlying, uint256 _amount) bytes32 _protocol) public;

/**
    @notice Unlend wrapped token from its lending protocol
    @param _wrapped Address of the wrapped token
    @param _amount Amount of the wrapped token to unlend
*/
    function unlend(address _wrapped, uint256 _amount) public;

/**
    @notice Unlend and immediately lend in a different protocol
    @param _wrapped Address of the wrapped token to bounce to another protocol
    @param _amount Amount of the wrapped token to bounce to the other protocol
    @param _toProtocol Protocol to deposit bounced tokens in
    */
    function bounce(address _wrapped, uint256 _amount, bytes32 _toProtocol) external;

```

## Lending Registry

The lending registry keeps track of all lending protocols and wrapped tokens. Only tokens and protocols registered in this registry can be used by the `LendingManager`. Currently supported lending protocols are Compound and Aave.