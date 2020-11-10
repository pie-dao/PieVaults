// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
pragma experimental ABIEncoderV2;

interface IBasketFacet {
    function setEntryFee(uint256 _fee) external;
    function getEntryFee() external view returns(uint256);

    function setExitFee(uint256 _fee) external;
    function getExitFee() external view returns(uint256);

    function setAnnualizedFee(uint256 _fee) external;
    function getAnnualizedFee() external view returns(uint256);

    function setFeeBeneficiary(address _beneficiary) external;
    function getFeeBeneficiary() external view returns(address);

    function setEntryFeeBeneficiaryShare(uint256 _share) external;
    function getEntryFeeBeneficiaryShare() external view returns(uint256);

    function setExitFeeBeneficiaryShare(uint256 _share) external;
    function getExitFeeBeneficiaryShare() external view returns(uint256);

    function calcOutStandingAnnualizedFee() external view returns(uint256);
    function chargeOutstandingAnnualizedFee() external;

    function joinPool(uint256 _amount) external;

    function exitPool(uint256 _amount) external;

    function getLock() external view returns (bool);

    function getLockBlock() external view returns (uint256);

    function setLock(uint256 _lock) external;

    function getCap() external view returns (uint256);

    function setCap(uint256 _maxCap) external returns (uint256);

    function balance(address _token) external view returns (uint256);

    function getTokens() external view returns (address[] memory);

    function addToken(address _token) external;

    function removeToken(address _token) external;

    function getTokenInPool(address _token) external view returns (bool);

    function calcTokensForAmount(uint256 _amount)
        external
        view
        returns (address[] memory tokens, uint256[] memory amounts);

    function calcTokensForAmountExit(uint256 _amount)
        external
        view
        returns (address[] memory tokens, uint256[] memory amounts);
}