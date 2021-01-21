// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

interface IERC1271Facet {
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);

    function isValidSignature(
        bytes32 _hash, 
        bytes memory _signature)
        external
        view 
    returns (bytes4);

    function addSigner(address _signer) external;
    function removeSigner(address _signer) external;
    function preSign(bytes32 _hash) external;
    function revokePreSign(bytes32 _hash) external;
}