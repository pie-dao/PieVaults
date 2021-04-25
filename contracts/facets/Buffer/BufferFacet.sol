
// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../shared/Reentry/ReentryProtection.sol";
import "../shared/Access/CallProtection.sol";
import "../../interfaces/ISynthetixExchangeRates.sol";
import "../Basket/LibBasketStorage.sol";
import "../ERC20/LibERC20Storage.sol";
import "./LibBufferStorage.sol";
import "../ERC20/LibERC20.sol";

interface IERC20MetaData {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);
    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);
    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}

contract BufferFacet is CallProtection, ReentryProtection {
    using SafeERC20 for IERC20;

    function enterSingleAsset(address _token, uint256 _tokenInAmount, uint256 _minMintAmount) external {
        LibBufferStorage.BufferStorage storage bfs = LibBufferStorage.bufferStorage();

        require(bfs.bufferAmount[_token] + _tokenInAmount <= bfs.bufferMax[_token], "Buffer too big");
        // TODO Check token in Vault
        bfs.bufferAmount[_token] = bfs.bufferAmount[_token] + _tokenInAmount;

        uint256 mintAmount = getVaultAmountFromInAmount(_token, _tokenInAmount);
        require(mintAmount >= _minMintAmount);
        IERC20(_token).transferFrom(msg.sender, address(this), _tokenInAmount);

        LibERC20.mint(msg.sender, mintAmount);
    }

    function exitSingleAsset(address _token, address _exitAmount) external {

    }


    function getOutAmountFromMintAmount(address _inputToken, address _mintAmount) public {

    }


    // TODO more readable calculations
    function getVaultAmountFromInAmount(address _inputToken, uint256 _inputTokenAmount) public returns(uint256) {
        LibBufferStorage.BufferStorage storage bfs = LibBufferStorage.bufferStorage();
        LibBasketStorage.BasketStorage storage bs = LibBasketStorage.basketStorage();
        LibERC20Storage.ERC20Storage storage es = LibERC20Storage.erc20Storage();

        ISynthetixExchangeRates rates = ISynthetixExchangeRates(bfs.exchangeRates);

        uint256 rawAmount = 0;

        for(uint256 i = 0; i < bs.tokens.length; i ++) {
            IERC20 token = bs.tokens[i];
            // TODO account for tokens in strategies
            uint256 tokenBalance =  token.balanceOf(address(this));
            // TODO better currencyKey fetching, or fetch from mapping somewhere
            rawAmount += rates.rateForCurrency(stringToBytes32(
                IERC20MetaData(address(token)).symbol()
            )) * tokenBalance / 1e18;
        }

        // TODO check rates decimals
        uint256 rawAmountInInputToken = rawAmount * 1e18 / rates.rateForCurrency(stringToBytes32(IERC20MetaData(_inputToken).symbol()));
        uint256 totalSupply = es.totalSupply;
        
        return totalSupply * _inputTokenAmount / rawAmountInInputToken;
    }

    function setBufferAmounts(address _token, uint256 _bufferAmount, uint256 _bufferMax) external protectedCall {
        LibBufferStorage.BufferStorage storage bfs = LibBufferStorage.bufferStorage();
        bfs.bufferAmount[_token] = _bufferAmount;
        bfs.bufferMax[_token] = _bufferMax;
    }

    function setExchangeRates(address _exchangeRates) external protectedCall {
        LibBufferStorage.BufferStorage storage bfs = LibBufferStorage.bufferStorage();
        bfs.exchangeRates = _exchangeRates;
    }

    // Utils

    function stringToBytes32(string memory source) public pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 32))
        }
    }
}