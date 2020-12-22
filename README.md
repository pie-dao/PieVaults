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

Contract address: `0xB739Dcf499306B191D9D4fa5255A8f20066a6a96`

With the following functions protocols and wrapped tokens can be added:

```solidity

/**
    @notice Set which protocl a wrapped token belongs to
    @param _wrapped Address of the wrapped token
    @param _protocol Bytes32 key of the protocol
*/
function setWrappedToProtocol(address _wrapped, bytes32 _protocol) external;

/**
    @notice Set what is the underlying for a wrapped token
    @param _wrapped Address of the wrapped token
    @param _underlying Address of the underlying token
*/
function setWrappedToUnderlying(address _wrapped, address _underlying) external;

/**
    @notice Set the logic contract for the protocol
    @param _protocol Bytes32 key of the procol
    @param _logic Address of the lending logic contract for that protocol
*/
function setProtocolToLogic(bytes32 _protocol, address _logic) external;

/**
    @notice Set the wrapped token for the underlying deposited in this protocol
    @param _underlying Address of the unerlying token
    @param _protocol Bytes32 key of the protocol
    @param _wrapped Address of the wrapped token
*/
function setUnderlyingToProtocolWrapped(address _underlying, bytes32 _protocol, address _wrapped) external;

```


### Lending logic contracts

| Protocol | Key                                                                | Address                                    |
|----------|--------------------------------------------------------------------|--------------------------------------------|
| Compound | 0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7 | 0xB9a13E1D9c5dad1557C3B9B20ab99fb0FB16cCA7 |
| Aave     | 0xa9699be9874dcc3e11474d7d87b44bb314eb412a1960f1478100f7e2ccd4a6eb | 0x6Eb123bbd02324600AcF8a53575547EEB0a43135 |
| Cream    | 0x40e45d329815e79a55e43916f11f7a0112a31146f63a4fcaea413df0567a0bb2 | 0x280190cF9E6519eB772a2f444fAF080523246DB3 |
| XSushi   | 0xeafaa563273a4fdf984f5a9f1836dba7d5800658b802d449eb6ee18fce3d7c81 | 0x38e0eb114BEC4efcD8b1AC2C4b0c7335AFC1491D |

Lending logic contracts return the calls needed to lend or unlend from a protocol.

## Deploying the factory
`npx buidler deploy-pie-factory --network mainnet`

## Deploying an ExperiPie

1. Create an allocation file like [this one](/allocations/mainnet/DLY.json)
2. run `npx buidler deploy-pie-from-factory --allocation [PATH_TO_ALLOCATION] --factory [FACTORY_ADDRESS] --network mainnet`
3. Copy the tx hash and search on Etherscan to find the address
4. Verify the contract: `npx buidler verify [PIE_ADDRESS] --constructor-args ./verify/experiPie.js` --network mainnet
