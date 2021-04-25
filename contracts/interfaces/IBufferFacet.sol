
interface IBufferFacet {
    function enterSingleAsset(address _token, uint256 _tokenInAmount, uint256 _minMintAmount) external;
    function exitSingleAsset(address _token, address _exitAmount) external;
    function getOutAmountFromMintAmount(address _inputToken, address _mintAmount) external returns(uint256);
    function getVaultAmountFromInAmount(address _inputToken, uint256 _inputTokenAmount) external returns(uint256);
    function setBufferAmounts(address _token, uint256 _bufferAmount, uint256 _bufferMax) external;
    function setExchangeRates(address _exchangeRates) external;
}