// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library LibFlashLoanStorage {
  bytes32 constant FLASH_LOAN_STORAGE_POSITION = keccak256(
    "diamond.standard.flashLoan.storage"
  );

  struct FlashLoanStorage {
    uint256 fee;
    uint256 feeBeneficiaryShare;
    address feeBeneficiary;
  }

  function flashLoanStorage() internal pure returns (FlashLoanStorage storage fls) {
    bytes32 position = FLASH_LOAN_STORAGE_POSITION;
    assembly {
      fls.slot := position
    }
  }
}