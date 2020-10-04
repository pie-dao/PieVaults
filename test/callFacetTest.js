/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */
const { parseEther } = require("ethers/lib/utils");
const { expect } = require("chai");
const { use } = require("chai");
const { solidity } = require("ethereum-waffle");
const { BigNumber } = require("ethers");
use(solidity);
const DiamondFactory = artifacts.require("DiamondFactory");
const DiamondCutFacet = artifacts.require("DiamondCutFacet");
const DiamondLoupeFacet = artifacts.require("DiamondLoupeFacet");
const BasketFacet = artifacts.require("BasketFacet");
const CallFacet = artifacts.require("CallFacet");
const ERC20Factory = artifacts.require("ERC20Factory");
const ERC20 = artifacts.require("ERC20");

contract("CallFacetTest", async (accounts) => {
  let erc20Factory;
  let dm = [];

  before(async () => {
    web3.eth.defaultAccount = accounts[0];
    diamondFactory = await DiamondFactory.deployed();
    events = await diamondFactory.getPastEvents("DiamondCreated", {
      fromBlock: 0,
      toBlock: "latest",
    });

    for (let i = 0; i < events.length; i++) {
      const diamond = events[i].returnValues.tokenAddress;
      dm.push({
        address: diamond,
        diamondCutFacet: new web3.eth.Contract(DiamondCutFacet.abi, diamond),
        diamondLoupeFacet: new web3.eth.Contract(
          DiamondLoupeFacet.abi,
          diamond
        ),
        basketFacet: new web3.eth.Contract(BasketFacet.abi, diamond),
        callFacet: new web3.eth.Contract(CallFacet.abi, diamond),
      });
    }

    await dm[0].basketFacet.methods.setMaxCap(parseEther("1000")).send({
      from: web3.eth.defaultAccount,
      gas: 1000000,
    });

    erc20Factory = await ERC20Factory.deployed();
  });

  describe("Call test", async () => {
    it("Test lock call", async () => {
      latestBlock = await web3.eth.getBlockNumber();
      lock = await dm[0].basketFacet.methods.getLock().call();
      expect(lock).to.eq(true);

      await dm[0].callFacet.methods
        .call(
          [dm[0].address],
          [dm[0].basketFacet.methods.setLock(latestBlock - 1).encodeABI()],
          [0]
        )
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      lock = await dm[0].basketFacet.methods.getLock().call();
      expect(lock).to.eq(false);
    });
    it("Test reentry call", async () => {
      await expect(
        dm[0].callFacet.methods
          .call(
            [dm[0].address],
            [dm[0].basketFacet.methods.joinPool(parseEther("1")).encodeABI()],
            [0]
          )
          .send({ from: web3.eth.defaultAccount, gas: 1000000 })
      ).to.be.revertedWith(
        "ReentryProtectionFacet.noReentry: reentry detected"
      );
    });
    it("Send contract ether", async () => {
      ether = await web3.eth.getBalance(dm[0].address);
      expect(ether).to.eq("0");

      await web3.eth.sendTransaction({
        from: accounts[2],
        to: dm[0].address,
        value: web3.utils.toWei("10", "ether"),
      });

      ether = await web3.eth.getBalance(dm[0].address);
      expect(ether).to.eq(parseEther("10"));

      userBalanceBefore = await web3.eth.getBalance(accounts[4]);
      userBalanceBefore = BigNumber.from(userBalanceBefore);

      await dm[0].callFacet.methods
        .call([accounts[4]], [[]], [parseEther("9")])
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      ether = await web3.eth.getBalance(dm[0].address);
      expect(ether).to.eq(parseEther("1"));

      userBalanceAfter = await web3.eth.getBalance(accounts[4]);
      userBalanceAfter = BigNumber.from(userBalanceAfter);

      difference = userBalanceAfter.sub(userBalanceBefore);
      expect(difference).to.eq(parseEther("9"));
    });
    it("Send contract erc20 token", async () => {
      token = await erc20Factory.deployNewToken(
        "TEST 12",
        "TST 12",
        parseEther("2000"),
        web3.eth.defaultAccount
      );
      address = token.receipt.rawLogs[0].address;
      token = new web3.eth.Contract(ERC20.abi, address);

      balance = await token.methods.balanceOf(dm[0].address).call();
      expect(balance).to.eq("0");

      await token.methods.transfer(dm[0].address, parseEther("1000")).send({
        from: web3.eth.defaultAccount,
        gas: 1000000,
      });

      balance = await token.methods.balanceOf(dm[0].address).call();
      expect(balance).to.eq(parseEther("1000"));

      await dm[0].callFacet.methods
        .call(
          [token.options.address],
          [token.methods.transfer(accounts[0], parseEther("800")).encodeABI()],
          [0]
        )
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      balance = await token.methods.balanceOf(dm[0].address).call();
      expect(balance).to.eq(parseEther("200"));
    });
    it("Lock + send ether + send erc20", async () => {
      latestBlock = await web3.eth.getBlockNumber();
      lock = await dm[0].basketFacet.methods.getLock().call();
      expect(lock).to.eq(false);

      ether = await web3.eth.getBalance(dm[0].address);
      expect(ether).to.eq(parseEther("1"));

      balance = await token.methods.balanceOf(dm[0].address).call();
      expect(balance).to.eq(parseEther("200"));

      await dm[0].callFacet.methods
        .call(
          [dm[0].address, token.options.address, accounts[4]],
          [
            dm[0].basketFacet.methods.setLock(latestBlock + 2).encodeABI(),
            token.methods.transfer(accounts[0], parseEther("200")).encodeABI(),
            [],
          ],
          [0, 0, parseEther("1")]
        )
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      lock = await dm[0].basketFacet.methods.getLock().call();
      expect(lock).to.eq(true);

      ether = await web3.eth.getBalance(dm[0].address);
      expect(ether).to.eq("0");

      balance = await token.methods.balanceOf(dm[0].address).call();
      expect(balance).to.eq("0");
    });
  });
});
