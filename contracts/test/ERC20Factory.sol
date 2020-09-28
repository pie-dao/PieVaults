pragma solidity ^0.7.0;

import "../openzeppelin/token/ERC20/ERC20.sol";

contract ERC20Factory {
    event TokenCreated(address tokenAddress);

    function deployNewToken(string memory name, string memory symbol, uint totalSupply, address issuer)
    public returns (address) {
        ERC20 t = new ERC20(name, symbol);
        t.mint(totalSupply, issuer);
        emit TokenCreated(address(t));
    }
}