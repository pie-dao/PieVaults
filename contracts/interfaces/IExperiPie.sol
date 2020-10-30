// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IExperiPie is IERC20 {
    // fee functions
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

    // function initialize(address[] memory _tokens, uint256 _maxCap) external;
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

    function mint(address _receiver, uint256 _amount) external;

    function burn(address _from, uint256 _amount) external;

    function calcTokensForAmount(uint256 _amount)
        external
        view
        returns (address[] memory tokens, uint256[] memory amounts);

    // CallFacet
    function call(
        address[] memory _targets,
        bytes[] memory _calldata,
        uint256[] memory _values
    ) external;

    function addCaller(address _caller) external;

    function removeCaller(address _caller) external;

    function canCall(address _caller) external view returns (bool);

    function getCallers() external view returns (address[] memory);

    // Ownership

    function transferOwnership(address _newOwner) external;

    function owner() external view returns (address);

    // ERC20
    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);

    // ERC20 facet
    function initialize(
        uint256 _initialSupply,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external;
}
