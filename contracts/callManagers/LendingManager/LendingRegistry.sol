// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.1;


import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/ILendingLogic.sol";

contract LendingRegistry is Ownable {

    // Maps wrapped token to protocol
    mapping(address => bytes32) public wrappedToProtocol;
    // Maps wrapped token to underlying
    mapping(address => address) public wrappedToUnderlying;

    mapping(address => mapping(bytes32 => address)) public underlyingToProtocolWrapped;

    // Maps protocol to addresses containing lend and unlend logic
    mapping(bytes32 => address) public protocolToLogic;

    function setWrappedToProtocol(address _wrapped, bytes32 _protocol) onlyOwner external {
        wrappedToProtocol[_wrapped] = _protocol;
    }

    function setWrappedToUnderlying(address _wrapped, address _underlying) onlyOwner external {
        wrappedToUnderlying[_wrapped] = _underlying;
    }

    function setProtocolToLogic(bytes32 _protocol, address _logic) onlyOwner external {
        protocolToLogic[_protocol] = _logic;
    }

    function setUnderlyingToProtocolWrapped(address _underlying, bytes32 _protocol, address _wrapped) onlyOwner external {
        underlyingToProtocolWrapped[_underlying][_protocol] = _wrapped;
    } 

    function getLendTXData(address _underlying, uint256 _amount, bytes32 _protocol) external returns(address[] memory targets, bytes[] memory data) {
        ILendingLogic lendingLogic = ILendingLogic(protocolToLogic[_protocol]);
        require(address(lendingLogic) != address(0), "NO_LENDING_LOGIC_SET");

        return lendingLogic.lend(_underlying, _amount);
    }

    function getUnlendTXData(address _wrapped, uint256 _amount) external returns(address[] memory targets, bytes[] memory data) {
        ILendingLogic lendingLogic = ILendingLogic(protocolToLogic[wrappedToProtocol[_wrapped]]);
        require(address(lendingLogic) != address(0), "NO_LENDING_LOGIC_SET");

        return lendingLogic.unlend(_wrapped, _amount); 
    }
}