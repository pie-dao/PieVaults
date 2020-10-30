// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../../interfaces/IFlashLoanReceiver.sol";
import "../shared/Reentry/ReentryProtection.sol";
import "../shared/Access/CallProtection.sol";

import "./LibFlashLoanStorage.sol";

contract FlashLoanFacet is ReentryProtection, CallProtection {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FLASH_LOAN_FEE = 10**17;

    function flashLoan(address _receiver, address _token, uint256 _amount, bytes calldata _params) external virtual noReentry {
        return _flashLoan(_receiver, _token, _amount, _params);
    }

    function _flashLoan(address _receiver, address _token, uint256 _amount, bytes memory _params) internal {
        LibFlashLoanStorage.FlashLoanStorage storage fls = LibFlashLoanStorage.flashLoanStorage();
        IERC20 token = IERC20(_token);

        uint256 feeAmount = _amount.mul(fls.fee).div(10**18);
        uint256 balanceBefore = token.balanceOf(address(this));
        // transfer tokens to receiver
        // TODO figure out why safeTransfer is not available on token
        SafeERC20.safeTransfer(token, _receiver, _amount);

        // execute callback
        IFlashLoanReceiver(_receiver).executeOperation(_token, _amount, feeAmount, _params);
        uint256 balanceAfter = token.balanceOf(address(this));

        require(balanceAfter >= balanceBefore.add(feeAmount), "LOAN_NOT_REPAID");

        // if there is a fee benificary and possibly a fee to pay out
        if(fls.feeBeneficiary != address(0) && fls.feeBeneficiaryShare != 0 && feeAmount != 0) {
            uint256 beneficiaryFeeAmount = feeAmount.mul(fls.feeBeneficiaryShare).div(10**18);

            if(beneficiaryFeeAmount != 0) {
                SafeERC20.safeTransfer(token, fls.feeBeneficiary, beneficiaryFeeAmount);
            }
        }
    }

    function setFlashLoanFeeBeneficiary(address _beneficiary) external protectedCall {
        LibFlashLoanStorage.flashLoanStorage().feeBeneficiary = _beneficiary;
    }
    
    function setFlashLoanFee(uint256 _fee) external protectedCall {
        require(_fee <= MAX_FLASH_LOAN_FEE, "FEE_TOO_BIG");
        LibFlashLoanStorage.flashLoanStorage().fee = _fee;
    }

    function setFlashLoanFeeBeneficiaryShare(uint256 _fee) external protectedCall {
        require(_fee <= 10**18, "FEE_SHARE_BIG");
        LibFlashLoanStorage.flashLoanStorage().feeBeneficiaryShare = _fee;
    }

}