// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
pragma experimental ABIEncoderV2;

interface IERC20Facet {
    // ERC20
    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);

    function mint(address _receiver, uint256 _amount) external;

    function burn(address _from, uint256 _amount) external;

    // ERC20 facet
    function initialize(
        uint256 _initialSupply,
        string memory _name,
        string memory _symbol
    ) external;
}