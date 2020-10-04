/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */
const { parseEther } = require("ethers/lib/utils");
const { expect } = require("chai");
const { use } = require("chai");
const { solidity } = require("ethereum-waffle");
use(solidity);
const DiamondFactory = artifacts.require("DiamondFactory");
const DiamondCutFacet = artifacts.require("DiamondCutFacet");
const DiamondLoupeFacet = artifacts.require("DiamondLoupeFacet");
const ERC20Facet = artifacts.require("ERC20Facet");
const zeroAddress = "0x0000000000000000000000000000000000000000";

contract("ERC20Test", async (accounts) => {
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
        erc20Facet: new web3.eth.Contract(ERC20Facet.abi, diamond),
      });
    }
  });

  // TODO initalize can be called multiple times
  describe("Initalize", async () => {
    it("Not owner", async () => {
      await expect(
        dm[0].erc20Facet.methods
          .initialize(parseEther("10"), "TEST 1", "TST1", 18)
          .send({ from: accounts[1], gas: 1000000 })
      ).to.be.revertedWith("Must own the contract.");
    });
    it("Initialize", async () => {
      // Check initital variables
      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[0]).call();
      expect(balance).to.be.eq(parseEther("0"));

      totalSupply = await dm[0].erc20Facet.methods.totalSupply().call();
      expect(totalSupply).to.be.eq(parseEther("0"));

      await dm[0].erc20Facet.methods
        .initialize(parseEther("10"), "TEST 1", "TST1", 10)
        .send({ from: accounts[0], gas: 1000000 });

      // Check result
      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[0]).call();
      expect(balance).to.be.eq(parseEther("10"));

      totalSupply = await dm[0].erc20Facet.methods.totalSupply().call();
      expect(totalSupply).to.be.eq(parseEther("10"));

      name = await dm[0].erc20Facet.methods.name().call();
      expect(name).to.be.eq("TEST 1");

      symbol = await dm[0].erc20Facet.methods.symbol().call();
      expect(symbol).to.be.eq("TST1");

      decimals = await dm[0].erc20Facet.methods.decimals().call();
      expect(decimals).to.be.eq("10");
    });
    it("Initialize twice", async () => {
      await dm[0].erc20Facet.methods
        .initialize(parseEther("15"), "TEST 2", "TST2", 18)
        .send({ from: accounts[0], gas: 1000000 });
      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[0]).call();
      expect(balance).to.be.eq(parseEther("25"));

      totalSupply = await dm[0].erc20Facet.methods.totalSupply().call();
      expect(totalSupply).to.be.eq(parseEther("25"));

      name = await dm[0].erc20Facet.methods.name().call();
      expect(name).to.be.eq("TEST 2");

      symbol = await dm[0].erc20Facet.methods.symbol().call();
      expect(symbol).to.be.eq("TST2");

      decimals = await dm[0].erc20Facet.methods.decimals().call();
      expect(decimals).to.be.eq("18");
    });
  });
  describe("transfer", async () => {
    it("transfer exceed balance (0)", async () => {
      await expect(
        dm[0].erc20Facet.methods
          .transfer(accounts[0], 1)
          .send({ from: accounts[2], gas: 1000000 })
      ).to.be.revertedWith("subtraction overflow");
    });
    it("transfer exceeds balance", async () => {
      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[0]).call();
      expect(balance).to.be.eq(parseEther("25"));

      await expect(
        dm[0].erc20Facet.methods
          .transfer(accounts[0], parseEther("30"))
          .send({ from: accounts[0], gas: 1000000 })
      ).to.be.revertedWith("subtraction overflow");
    });
    it("transfer success", async () => {
      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[0]).call();
      expect(balance).to.be.eq(parseEther("25"));

      totalSupply = await dm[0].erc20Facet.methods.totalSupply().call();
      expect(totalSupply).to.be.eq(parseEther("25"));

      await dm[0].erc20Facet.methods
        .transfer(accounts[1], parseEther("5"))
        .send({ from: accounts[0], gas: 1000000 });

      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[0]).call();
      expect(balance).to.be.eq(parseEther("20"));

      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[1]).call();
      expect(balance).to.be.eq(parseEther("5"));

      totalSupply = await dm[0].erc20Facet.methods.totalSupply().call();
      expect(totalSupply).to.be.eq(parseEther("25"));
    });
    it("transfer burn address", async () => {
      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[0]).call();
      expect(balance).to.be.eq(parseEther("20"));

      totalSupply = await dm[0].erc20Facet.methods.totalSupply().call();
      expect(totalSupply).to.be.eq(parseEther("25"));

      await dm[0].erc20Facet.methods
        .transfer(zeroAddress, parseEther("5"))
        .send({ from: accounts[0], gas: 1000000 });

      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[0]).call();
      expect(balance).to.be.eq(parseEther("15"));

      totalSupply = await dm[0].erc20Facet.methods.totalSupply().call();
      expect(totalSupply).to.be.eq(parseEther("20"));
    });
  });
  describe("allowance", async () => {
    it("give allowance", async () => {
      allowance = await dm[0].erc20Facet.methods
        .allowance(accounts[0], accounts[1])
        .call();
      expect(allowance).to.be.eq("0");

      allowance = await dm[0].erc20Facet.methods
        .allowance(accounts[1], accounts[0])
        .call();
      expect(allowance).to.be.eq("0");

      await dm[0].erc20Facet.methods
        .approve(accounts[1], parseEther("5000"))
        .send({ from: accounts[0], gas: 1000000 });

      allowance = await dm[0].erc20Facet.methods
        .allowance(accounts[0], accounts[1])
        .call();
      expect(allowance).to.be.eq(parseEther("5000"));

      allowance = await dm[0].erc20Facet.methods
        .allowance(accounts[1], accounts[0])
        .call();
      expect(allowance).to.be.eq("0");
    });
    it("give allowance, second time", async () => {
      allowance = await dm[0].erc20Facet.methods
        .allowance(accounts[0], accounts[1])
        .call();
      expect(allowance).to.be.eq(parseEther("5000"));

      await dm[0].erc20Facet.methods
        .approve(accounts[1], parseEther("12"))
        .send({ from: accounts[0], gas: 1000000 });

      allowance = await dm[0].erc20Facet.methods
        .allowance(accounts[0], accounts[1])
        .call();
      expect(allowance).to.be.eq(parseEther("12"));
    });
    it("transfer from, no allowance", async () => {
      await expect(
        dm[0].erc20Facet.methods
          .transferFrom(accounts[0], accounts[2], 1)
          .send({ from: accounts[3], gas: 1000000 })
      ).to.be.revertedWith("subtraction overflow");
    });
    it("transfer from, exceeds allowance", async () => {
      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[0]).call();
      expect(balance).to.be.eq(parseEther("15"));

      allowance = await dm[0].erc20Facet.methods
        .allowance(accounts[0], accounts[1])
        .call();
      expect(allowance).to.be.eq(parseEther("12"));

      await expect(
        dm[0].erc20Facet.methods
          .transferFrom(accounts[0], accounts[2], parseEther("14"))
          .send({ from: accounts[3], gas: 1000000 })
      ).to.be.revertedWith("subtraction overflow");
    });
    it("transfer from", async () => {
      allowance = await dm[0].erc20Facet.methods
        .allowance(accounts[0], accounts[1])
        .call();
      expect(allowance).to.be.eq(parseEther("12"));

      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[0]).call();
      expect(balance).to.be.eq(parseEther("15"));

      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[1]).call();
      expect(balance).to.be.eq(parseEther("5"));

      await dm[0].erc20Facet.methods
        .transferFrom(accounts[0], accounts[2], parseEther("10"))
        .send({ from: accounts[1], gas: 1000000 });

      allowance = await dm[0].erc20Facet.methods
        .allowance(accounts[0], accounts[1])
        .call();
      expect(allowance).to.be.eq(parseEther("2"));

      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[0]).call();
      expect(balance).to.be.eq(parseEther("5"));

      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[1]).call();
      expect(balance).to.be.eq(parseEther("5"));

      balance = await dm[0].erc20Facet.methods.balanceOf(accounts[2]).call();
      expect(balance).to.be.eq(parseEther("10"));
    });
  });
});
