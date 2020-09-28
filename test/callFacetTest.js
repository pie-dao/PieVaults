/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */
const { parseEther } = require('ethers/lib/utils')
const { expect } = require('chai')
const { use } = require('chai')
const { solidity } = require('ethereum-waffle');
const { BigNumber } = require('ethers');
use(solidity);
const Diamond = artifacts.require('Diamond')
const DiamondCutFacet = artifacts.require('DiamondCutFacet')
const DiamondLoupeFacet = artifacts.require('DiamondLoupeFacet')
const BasketFacet = artifacts.require('BasketFacet')
const CallFacet = artifacts.require('CallFacet')
const ERC20Factory = artifacts.require('ERC20Factory')
const ERC20 = artifacts.require('ERC20')
let zeroAddress = '0x0000000000000000000000000000000000000000'
contract('CallFacetTest', async accounts => {
    let diamond;
    let diamondCutFacet
    let diamondLoupeFacet
    let callFacet;
    let basketFacet;
    let erc20Factory;

    function getSelectors (contract) {
      const selectors = contract.abi.reduce((acc, val) => {
        if (val.type === 'function') {
          acc.push(val.signature)
          return acc
        } else {
          return acc
        }
      }, [])
      return selectors
    }

    before(async () => {
        web3.eth.defaultAccount = accounts[0]
        diamond = await Diamond.deployed()
        diamondCutFacet = new web3.eth.Contract(DiamondCutFacet.abi, diamond.address)
        diamondLoupeFacet = new web3.eth.Contract(DiamondLoupeFacet.abi, diamond.address)
        callFacet = await CallFacet.deployed()
        basketFacet = await BasketFacet.deployed()
        erc20Factory = await ERC20Factory.deployed()

        // Attach CallFacet to diamond
        selectors = getSelectors(callFacet)
        await diamondCutFacet.methods.diamondCut(
          [[callFacet.address, selectors]], zeroAddress, '0x'
        ).send({ from: web3.eth.defaultAccount, gas: 1000000 })

        // Attach BasketFacet to diamond
        selectors = getSelectors(basketFacet)
        await diamondCutFacet.methods.diamondCut(
          [[basketFacet.address, selectors]], zeroAddress, '0x'
        ).send({ from: web3.eth.defaultAccount, gas: 1000000 })

        // Reinitialize callFacet, basketFacet
        // Using the diamond address
        callFacet = new web3.eth.Contract(CallFacet.abi, diamond.address);
        basketFacet = new web3.eth.Contract(BasketFacet.abi, diamond.address);
        await basketFacet.methods.setMaxCap(parseEther("1000")).send({
          from: web3.eth.defaultAccount, gas: 1000000
        })
    });

    describe("Call test", async() => {
      it('Test lock call', async () => {
        latestBlock = await web3.eth.getBlockNumber();
        lock = await basketFacet.methods.getLock().call();
        expect(lock).to.eq(true)

        await callFacet.methods.call(
          [basketFacet.options.address],
          [basketFacet.methods.setLock(latestBlock - 1).encodeABI()],
          [0]
        ).send({from: web3.eth.defaultAccount, gas: 1000000})

        lock = await basketFacet.methods.getLock().call();
        expect(lock).to.eq(false)
      });
      it('Test reentry call', async () => {
        await expect(
          callFacet.methods.call(
            [basketFacet.options.address],
            [basketFacet.methods.joinPool(parseEther("1")).encodeABI()],
            [0]
          ).send({from: web3.eth.defaultAccount, gas: 1000000})
        ).to.be.revertedWith("ReentryProtectionFacet.noReentry: reentry detected")
      });
      it('Send contract ether', async () => {
        ether = await web3.eth.getBalance(diamond.address)
        expect(ether).to.eq("0")

        await web3.eth.sendTransaction({from: accounts[2],to: diamond.address, value: web3.utils.toWei("10", "ether")})

        ether = await web3.eth.getBalance(diamond.address)
        expect(ether).to.eq(parseEther("10"))

        userBalanceBefore = await web3.eth.getBalance(accounts[4])
        userBalanceBefore = BigNumber.from(userBalanceBefore)

        await callFacet.methods.call(
          [accounts[4]],
          [[]],
          [parseEther("9")]
        ).send({from: web3.eth.defaultAccount, gas: 1000000})

        ether = await web3.eth.getBalance(diamond.address)
        expect(ether).to.eq(parseEther("1"))

        userBalanceAfter = await web3.eth.getBalance(accounts[4])
        userBalanceAfter = BigNumber.from(userBalanceAfter)

        difference = userBalanceAfter.sub(userBalanceBefore)
        expect(difference).to.eq(parseEther("9"))
      });
      it('Send contract erc20 token', async () => {
        token = await erc20Factory.deployNewToken("TEST 12", "TST 12", parseEther("2000"), web3.eth.defaultAccount)
        address = token.receipt.rawLogs[0].address;
        token = new web3.eth.Contract(ERC20.abi, address);

        balance = await token.methods.balanceOf(diamond.address).call();
        expect(balance).to.eq("0")

        await token.methods.transfer(diamond.address, parseEther("1000")).send({
          from: web3.eth.defaultAccount, gas: 1000000
        })

        balance = await token.methods.balanceOf(diamond.address).call();
        expect(balance).to.eq(parseEther("1000"))

        await callFacet.methods.call(
          [token.options.address],
          [token.methods.transfer(accounts[0], parseEther("800")).encodeABI()],
          [0]
        ).send({from: web3.eth.defaultAccount, gas: 1000000})

        balance = await token.methods.balanceOf(diamond.address).call();
        expect(balance).to.eq(parseEther("200"))
      })
      it('Lock + send ether + send erc20', async () => {
        latestBlock = await web3.eth.getBlockNumber();
        lock = await basketFacet.methods.getLock().call();
        expect(lock).to.eq(false)

        ether = await web3.eth.getBalance(diamond.address)
        expect(ether).to.eq(parseEther("1"))

        balance = await token.methods.balanceOf(diamond.address).call();
        expect(balance).to.eq(parseEther("200"))

        await callFacet.methods.call(
          [
            basketFacet.options.address,
            token.options.address,
            accounts[4]
          ],
          [
            basketFacet.methods.setLock(latestBlock + 2).encodeABI(),
            token.methods.transfer(accounts[0], parseEther("200")).encodeABI(),
            []
          ],
          [0, 0, parseEther("1")]
        ).send({from: web3.eth.defaultAccount, gas: 1000000})

        lock = await basketFacet.methods.getLock().call();
        expect(lock).to.eq(true)

        ether = await web3.eth.getBalance(diamond.address)
        expect(ether).to.eq("0")

        balance = await token.methods.balanceOf(diamond.address).call();
        expect(balance).to.eq("0")
      })
    })
});