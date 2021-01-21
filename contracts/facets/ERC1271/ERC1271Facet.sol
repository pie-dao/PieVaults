// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../../interfaces/IERC1271Facet.sol";
import "../shared/Access/CallProtection.sol";
import "./Lib1271Storage.sol";

contract ERC1271Facet is IERC1271Facet, CallProtection {
    // bytes4(keccak256("isValidSignature(bytes32,bytes)")
    bytes4 constant internal MAGICVALUE = 0x1626ba7e;

    /**
    * @dev Should return whether the signature provided is valid for the provided data
    * @param _hash      Hash of the data to be signed
    * @param _signature Signature byte array associated with _data
    */ 
    function isValidSignature(
        bytes32 _hash, 
        bytes memory _signature)
        external
        override
        view 
    returns (bytes4) {   
        LibERC1271Storage.ERC1271Storage storage es = LibERC1271Storage.erc1271Storage();

        if(es.isApproved[_hash]) {
            return MAGICVALUE;
        }

        address signer = ECDSA.recover(_hash, _signature);

        if(es.isSigner[signer]) {
            return MAGICVALUE;
        }

        // If not presigned or from a whitelisted signer
        return bytes4(0);
    }

    function addSigner(address _signer) external override protectedCall {
        LibERC1271Storage.ERC1271Storage storage es = LibERC1271Storage.erc1271Storage();
        require(es.isSigner[_signer] == false, "Signer already added");
        es.isSigner[_signer] = true;
        es.signers.push(_signer);

        emit SignerAdded(_signer);
    }

    function removeSigner(address _signer) external override protectedCall {
        LibERC1271Storage.ERC1271Storage storage es = LibERC1271Storage.erc1271Storage();
        require(es.isSigner[_signer] == true, "Is not a signer");
        es.isSigner[_signer] = false;
        
        for(uint256 i = 0; i < es.signers.length; i ++) {
            address currentSigner = es.signers[i];

            if(_signer == currentSigner) {
                es.signers[i] = es.signers[es.signers.length - 1];
                es.signers.pop();
                break;
            }
        }

        emit SignerRemoved(_signer);
    }

    function preSign(bytes32 _hash) external override protectedCall {
        LibERC1271Storage.erc1271Storage().isApproved[_hash] = true;
    }

    function revokePreSign(bytes32 _hash) external override protectedCall {
        LibERC1271Storage.erc1271Storage().isApproved[_hash] = false;
    }
}