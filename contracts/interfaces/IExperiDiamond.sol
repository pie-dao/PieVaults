// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

pragma experimental ABIEncoderV2;
import "../openzeppelin/token/ERC20/IERC20.sol";

interface IExperiDiamond {
  // BasketFacet
  function initialize(address[] memory _tokens, uint256 _maxCap) external;

  function joinPool(uint256 _amount) external;

  function exitPool(uint256 _amount) external;

  function getLock() external view returns (bool);

  function setLock(uint256 _lock) external;

  function getMaxCap() external view returns (uint256);

  function setMaxCap(uint256 _maxCap) external returns (uint256);

  function balance(address _token) external view returns (uint256);

  function getTokens() external view returns (IERC20[] memory);

  // CallFacet
  function call(
    address[] memory _targets,
    bytes[] memory _calldata,
    uint256[] memory _values
  ) external;

  // ERC20Facet
  function initialize(
    uint256 _initialSupply,
    string memory _name,
    string memory _symbol,
    uint8 _decimals
  ) external;

  function name() external view returns (string memory);

  function symbol() external view returns (string memory);

  function decimals() external view returns (uint8);

  function approve(address _spender, uint256 _amount) external returns (bool);

  function transfer(address _to, uint256 _amount) external returns (bool);

  function transferFrom(
    address _from,
    address _to,
    uint256 _amount
  ) external returns (bool);

  function allowance(address _owner, address _spender)
    external
    view
    returns (uint256);

  function balanceOf(address _of) external view returns (uint256);

  function totalSupply() external view returns (uint256);
}
