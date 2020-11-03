// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/ILendingLogic.sol";
import "../../interfaces/IAToken.sol";
import "../../interfaces/IAaveLendingPool.sol";

contract LendingLogicAave is ILendingLogic {

    IAaveLendingPool public lendingPool;

    constructor(address _lendingPool) {
        lendingPool = IAaveLendingPool(_lendingPool);
    }

    function lend(address _underlying, uint256 _amount) external override returns(address[] memory targets, bytes[] memory data) {
        IERC20 underlying = IERC20(_underlying);

        targets = new address[](3);
        data = new bytes[](3);

        // zero out approval to be sure
        targets[0] = _underlying;
        data[0] = abi.encodeWithSelector(underlying.approve.selector, address(lendingPool), 0);

        // Set approval
        targets[1] = _underlying;
        data[1] = abi.encodeWithSelector(underlying.approve.selector, address(lendingPool), _amount);

        // Deposit into Aave
        targets[2] = address(lendingPool);
        // TODO set referral
        data[2] =  abi.encodeWithSelector(lendingPool.deposit.selector, _underlying, _amount, 0);

        return(targets, data);
    }
    function unlend(address _wrapped, uint256 _amount) external override returns(address[] memory targets, bytes[] memory data) {
        targets = new address[](1);
        data = new bytes[](1);

        targets[0] = _wrapped;
        data[0] = abi.encodeWithSelector(IAToken.redeem.selector, _amount);
        
        return(targets, data);
    }

    // TODO add getter for interest rate
}