// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "./FlashLoanFacet.sol";
import "../ERC20/LibERC20.sol";

contract FlashLoanMint is FlashLoanFacet {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    function flashLoan(address _receiver, address _token, uint256 _amount, bytes calldata _params) external override noReentry {
        if(_token != address(this)) {
            return _flashLoan(_receiver, _token, _amount, _params);
        }

        LibFlashLoanStorage.FlashLoanStorage storage fls = LibFlashLoanStorage.flashLoanStorage();
        IERC20 tokenSelf = IERC20(_token);
    
        uint256 balanceBefore = tokenSelf.balanceOf(_token);
        uint256 feeAmount = _amount.mul(fls.fee).div(10**18);

        LibERC20.mint(_receiver, _amount);

        // execute callback
        IFlashLoanReceiver(_receiver).executeOperation(_token, _amount, feeAmount, _params);
        uint256 balanceAfter = tokenSelf.balanceOf(_token);

        require(balanceAfter >= balanceBefore.add(feeAmount).add(_amount), "LOAN_NOT_REPAID");

        // if there is a fee benificary and possibly a fee to pay out
        if(fls.feeBeneficiary != address(0) && fls.feeBeneficiaryShare != 0 && feeAmount != 0) {
            uint256 beneficiaryFeeAmount = feeAmount.mul(fls.feeBeneficiaryShare).div(10**18);

            if(beneficiaryFeeAmount != 0) {
                SafeERC20.safeTransfer(tokenSelf, fls.feeBeneficiary, beneficiaryFeeAmount);
            }

        }

        LibERC20.burn(address(this), _amount); //burn the flash loaned amount
    }
}