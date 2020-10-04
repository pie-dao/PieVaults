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
const BasketFacet = artifacts.require("BasketFacet");
const ERC20Facet = artifacts.require("ERC20Facet");
const ERC20Factory = artifacts.require("ERC20Factory");
const ERC20 = artifacts.require("ERC20");

// initalize diamond 0,1,2
contract("BasketFacetTest", async (accounts) => {
  let tokens = [];
  let dm = [];
  let erc20Factory;

  const waitNBlocks = async (n) => {
    await Promise.all(
      [...Array(n).keys()].map((i) =>
        web3.currentProvider.send(
          {
            jsonrpc: "2.0",
            method: "evm_mine",
            params: [],
            id: new Date().getTime(),
          },
          () => {}
        )
      )
    );
  };

  before(async () => {
    web3.eth.defaultAccount = accounts[0];
    diamondFactory = await DiamondFactory.deployed();
    events = await diamondFactory.getPastEvents("DiamondCreated", {
      fromBlock: 0,
      toBlock: "latest",
    });

    for (let i = 0; i <= 2; i++) {
      const diamond = events[i].returnValues.tokenAddress;
      dm.push({
        address: diamond,
        diamondCutFacet: new web3.eth.Contract(DiamondCutFacet.abi, diamond),
        diamondLoupeFacet: new web3.eth.Contract(
          DiamondLoupeFacet.abi,
          diamond
        ),
        basketFacet: new web3.eth.Contract(BasketFacet.abi, diamond),
        erc20Facet: new web3.eth.Contract(ERC20Facet.abi, diamond),
      });
    }

    erc20Factory = await ERC20Factory.deployed();
    for (let i = 0; i < 3; i++) {
      token = await erc20Factory.deployNewToken(
        "TEST ${i}",
        "TST${i}",
        parseEther("2000"),
        web3.eth.defaultAccount
      );
      address = token.receipt.rawLogs[0].address;

      token = new web3.eth.Contract(ERC20.abi, address);
      await token.methods.transfer(accounts[2], parseEther("1000")).send({
        from: web3.eth.defaultAccount,
        gas: 1000000,
      });
      await token.methods
        .approve(dm[0].address, parseEther("100000000"))
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });
      await token.methods
        .approve(dm[0].address, parseEther("100000000"))
        .send({ from: accounts[2], gas: 1000000 });
      tokens.push(token);
    }
  });
  describe("MaxCap", async () => {
    it("Check default cap", async () => {
      maxCap = await dm[0].basketFacet.methods.getMaxCap().call();
      expect(maxCap).to.be.eq("0");
    });
    it("Test setMaxCap not allowed", async () => {
      await expect(
        dm[0].basketFacet.methods
          .setMaxCap(parseEther("1000"))
          .send({ from: accounts[1], gas: 1000000 })
      ).to.be.revertedWith("NOT_ALLOWED");
    });
    it("Set max cap", async () => {
      await dm[0].basketFacet.methods
        .setMaxCap(parseEther("100"))
        .send({ from: accounts[0], gas: 1000000 });
      maxCap = await dm[0].basketFacet.methods.getMaxCap().call();
      expect(maxCap).to.be.eq(parseEther("100"));
    });
  });
  describe("Lock", async () => {
    it("Check default locked", async () => {
      lock = await dm[0].basketFacet.methods.getLock().call();
      assert.equal(lock, true);
    });
    it("Test setlock not allowed", async () => {
      await expect(
        dm[0].basketFacet.methods
          .setLock(1)
          .send({ from: accounts[1], gas: 1000000 })
      ).to.be.revertedWith("NOT_ALLOWED");
    });
    it("Check past lock", async () => {
      // set blockNumber to at least 2
      await waitNBlocks(2);

      // set lock in the past
      await dm[0].basketFacet.methods
        .setLock(1)
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });
      lock = await dm[0].basketFacet.methods.getLock().call();
      assert.equal(lock, false);
    });
    it("Check future lock", async () => {
      latestBlock = await web3.eth.getBlockNumber();
      // set lock in the future
      await dm[0].basketFacet.methods
        .setLock(latestBlock + 1)
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });
      lock = await dm[0].basketFacet.methods.getLock().call();
      assert.equal(lock, true);
    });
    it("Check current block lock", async () => {
      // assert lock == currentblock
      assert.equal(await web3.eth.getBlockNumber(), latestBlock + 1);

      // should still be locked (block is including)
      lock = await dm[0].basketFacet.methods.getLock().call();
      assert.equal(lock, true);
    });
    it("Wait for lock expires", async () => {
      await waitNBlocks(1);
      assert.equal(await web3.eth.getBlockNumber(), latestBlock + 2);

      // should be unlocked
      lock = await dm[0].basketFacet.methods.getLock().call();
      assert.equal(lock, false);
    });
  });

  describe("Initalize", async () => {
    it("Not enough pool balance", async () => {
      await expect(
        dm[0].basketFacet.methods
          .initialize([tokens[0].options.address], parseEther("10"))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 })
      ).to.be.revertedWith("POOL_TOKEN_BALANCE_TOO_LOW");
    });
    it("Not enough token balance", async () => {
      await dm[0].erc20Facet.methods
        .initialize(parseEther("10"), "TEST 1", "TST1", 18)
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      await expect(
        dm[0].basketFacet.methods
          .initialize([tokens[0].options.address], parseEther("5"))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 })
      ).to.be.revertedWith("MAX_POOL_CAP_REACHED");
    });
    it("Not enough token balance", async () => {
      await dm[1].erc20Facet.methods
        .initialize(parseEther("10"), "TEST 1", "TST1", 18)
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      await expect(
        dm[1].basketFacet.methods
          .initialize([tokens[0].options.address], parseEther("1000"))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 })
      ).to.be.revertedWith("TOKEN_BALANCE_TOO_LOW");
    });
    it("Not owner", async () => {
      await expect(
        dm[1].basketFacet.methods
          .initialize([], parseEther("1000"))
          .send({ from: accounts[1], gas: 1000000 })
      ).to.be.revertedWith("Must own the contract.");
    });
    it("Initialize successful", async () => {
      // set lock
      await dm[2].basketFacet.methods
        .setLock(0)
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      addresses = [];
      for (var i = 0; i < tokens.length; i++) {
        await tokens[i].methods
          .transfer(dm[2].address, parseEther("100"))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 });
        addresses.push(tokens[i].options.address);
      }

      await dm[2].erc20Facet.methods
        .initialize(parseEther("10"), "TEST 1", "TST1", 18)
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      lock = await dm[2].basketFacet.methods.getLock().call();
      assert.equal(lock, true);

      // finaly initialize pool
      await dm[2].basketFacet.methods
        .initialize(addresses, parseEther("50000"))
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      lock = await dm[2].basketFacet.methods.getLock().call();
      assert.equal(lock, false);
    });
  });
});

// initialize diamond 3, 4, 5, 6, 7, 8
contract("BasketFacetTestUse", async (accounts) => {
  let tokens = [];
  let dm = [];
  let erc20Factory;

  before(async () => {
    web3.eth.defaultAccount = accounts[0];
    diamondFactory = await DiamondFactory.deployed();
    events = await diamondFactory.getPastEvents("DiamondCreated", {
      fromBlock: 0,
      toBlock: "latest",
    });
    erc20Factory = await ERC20Factory.deployed();

    // Initial pool equity
    //    web3.eth.defaultAccount: 10
    // Initial pool token balances (every token)
    //    web3.eth.defaultAccount: 900
    //    account[2]: 1000
    //    diamond: 100
    for (let i = 3; i <= 8; i++) {
      const diamond = events[i].returnValues.tokenAddress;
      tokens = [];
      addresses = [];

      // initialize tokens
      for (let i = 0; i < 3; i++) {
        token = await erc20Factory.deployNewToken(
          "TEST ${i}",
          "TST${i}",
          parseEther("2000"),
          web3.eth.defaultAccount
        );
        address = token.receipt.rawLogs[0].address;

        token = new web3.eth.Contract(ERC20.abi, address);
        await token.methods.transfer(accounts[2], parseEther("1000")).send({
          from: web3.eth.defaultAccount,
          gas: 1000000,
        });
        await token.methods
          .transfer(diamond, parseEther("100"))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 });

        await token.methods
          .approve(diamond, parseEther("100000000"))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 });
        await token.methods
          .approve(diamond, parseEther("100000000"))
          .send({ from: accounts[2], gas: 1000000 });

        tokens.push(token);
        addresses.push(token.options.address);
      }
      const erc20Facet = new web3.eth.Contract(ERC20Facet.abi, diamond);
      await erc20Facet.methods
        .initialize(parseEther("10"), "TEST 1", "TST1", 18)
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      // finaly initialize pool
      const basketFacet = new web3.eth.Contract(BasketFacet.abi, diamond);
      await basketFacet.methods
        .initialize(addresses, parseEther("50000"))
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      dm.push({
        address: diamond,
        diamondCutFacet: new web3.eth.Contract(DiamondCutFacet.abi, diamond),
        diamondLoupeFacet: new web3.eth.Contract(
          DiamondLoupeFacet.abi,
          diamond
        ),
        basketFacet: basketFacet,
        erc20Facet: erc20Facet,
        tokens: tokens,
      });
    }
  });

  async function validateInitialBalance(diamond) {
    for (var i = 0; i < diamond.tokens.length; i++) {
      balanceDiamond = await diamond.tokens[i].methods
        .balanceOf(diamond.address)
        .call();
      expect(balanceDiamond).to.eq(parseEther("100"));

      // validate internal balance call
      balanceDiamondInternal = await diamond.basketFacet.methods
        .balance(diamond.tokens[i].options.address)
        .call();
      expect(balanceDiamondInternal).to.eq(balanceDiamond);

      balanceUser = await diamond.tokens[i].methods
        .balanceOf(web3.eth.defaultAccount)
        .call();
      expect(balanceUser).to.eq(parseEther("900"));

      balanceUser2 = await diamond.tokens[i].methods
        .balanceOf(accounts[2])
        .call();
      expect(balanceUser2).to.eq(parseEther("1000"));

      totalSupply = await diamond.tokens[i].methods.totalSupply().call();
      expect(totalSupply).to.eq(parseEther("2000"));
    }

    tokensUser = await diamond.erc20Facet.methods
      .balanceOf(web3.eth.defaultAccount)
      .call();
    expect(tokensUser).to.eq(parseEther("10"));

    totalSupply = await diamond.erc20Facet.methods.totalSupply().call();
    expect(totalSupply).to.eq(parseEther("10"));
  }

  describe("Joining and exiting", async () => {
    // transfer initial token liquidity
    before(async () => {
      latestBlock = await web3.eth.getBlockNumber();
    });

    it("Test locks", async () => {
      await dm[0].basketFacet.methods.setLock(latestBlock + 5).send({
        from: web3.eth.defaultAccount,
        gas: 1000000,
      });

      await expect(
        dm[0].basketFacet.methods
          .joinPool(parseEther("1"))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 })
      ).to.be.revertedWith("POOL_LOCKED");

      await expect(
        dm[0].basketFacet.methods
          .exitPool(parseEther("1"))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 })
      ).to.be.revertedWith("POOL_LOCKED");
    });
    it("Join pool", async () => {
      await validateInitialBalance(dm[1]);

      await dm[1].basketFacet.methods
        .joinPool(parseEther("10"))
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      for (var i = 0; i < dm[1].tokens.length; i++) {
        balanceDiamond = await dm[1].tokens[i].methods
          .balanceOf(dm[1].address)
          .call();
        expect(balanceDiamond).to.eq(parseEther("200"));

        balanceUser = await dm[1].tokens[i].methods
          .balanceOf(web3.eth.defaultAccount)
          .call();
        expect(balanceUser).to.eq(parseEther("800"));
      }
      tokensUser = await dm[1].erc20Facet.methods
        .balanceOf(web3.eth.defaultAccount)
        .call();
      expect(tokensUser).to.eq(parseEther("20"));

      totalSupply = await dm[1].erc20Facet.methods.totalSupply().call();
      expect(totalSupply).to.eq(parseEther("20"));
    });
    it("Exit pool", async () => {
      await validateInitialBalance(dm[2]);

      await dm[2].basketFacet.methods
        .exitPool(parseEther("5"))
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      for (var i = 0; i < dm[2].tokens.length; i++) {
        balanceDiamond = await dm[2].tokens[i].methods
          .balanceOf(dm[2].address)
          .call();
        expect(balanceDiamond).to.eq(parseEther("50"));

        balanceUser = await dm[2].tokens[i].methods
          .balanceOf(web3.eth.defaultAccount)
          .call();
        expect(balanceUser).to.eq(parseEther("950"));
      }
      tokensUser = await dm[2].erc20Facet.methods
        .balanceOf(web3.eth.defaultAccount)
        .call();
      expect(tokensUser).to.eq(parseEther("5"));

      totalSupply = await dm[2].erc20Facet.methods.totalSupply().call();
      expect(totalSupply).to.eq(parseEther("5"));
    });
    it("Join fails if it exceeds balance", async () => {
      await validateInitialBalance(dm[3]);

      await expect(
        dm[3].basketFacet.methods
          .joinPool(parseEther("10000"))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 })
      ).to.be.revertedWith("transfer amount exceeds balance");
    });
    it("Exit fails if it exceeds MIN_AMOUNT", async () => {
      await validateInitialBalance(dm[3]);

      tokensUser = await dm[3].erc20Facet.methods
        .balanceOf(web3.eth.defaultAccount)
        .call();
      expect(tokensUser).to.eq(parseEther("10"));

      await expect(
        dm[3].basketFacet.methods
          .exitPool(parseEther("10").sub(1))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 })
      ).to.be.revertedWith("TOKEN_BALANCE_TOO_LOW");
    });
    it("Join pool with two accounts", async () => {
      await validateInitialBalance(dm[3]);

      await dm[3].basketFacet.methods
        .joinPool(parseEther("10"))
        .send({ from: web3.eth.defaultAccount, gas: 1000000 });

      await dm[3].basketFacet.methods
        .joinPool(parseEther("10"))
        .send({ from: accounts[2], gas: 1000000 });

      tokensUser = await dm[3].erc20Facet.methods
        .balanceOf(web3.eth.defaultAccount)
        .call();
      expect(tokensUser).to.eq(parseEther("20"));
      tokensUser2 = await dm[3].erc20Facet.methods
        .balanceOf(accounts[2])
        .call();
      expect(tokensUser2).to.eq(parseEther("10"));

      poolTotal = await dm[3].erc20Facet.methods.totalSupply().call();
      expect(poolTotal).to.eq(parseEther("30"));
      for (var i = 0; i < dm[3].tokens.length; i++) {
        balanceDiamond = await dm[3].tokens[i].methods
          .balanceOf(dm[3].address)
          .call();
        expect(balanceDiamond).to.eq(parseEther("300"));

        balanceUser = await dm[3].tokens[i].methods
          .balanceOf(web3.eth.defaultAccount)
          .call();
        expect(balanceUser).to.eq(parseEther("800"));

        balanceUser2 = await dm[3].tokens[i].methods
          .balanceOf(accounts[2])
          .call();
        expect(balanceUser2).to.eq(parseEther("900"));
      }
    });
    it("Exit fails if it exceeds balance of user", async () => {
      await validateInitialBalance(dm[4]);

      await dm[4].basketFacet.methods
        .joinPool(parseEther("10"))
        .send({ from: accounts[2], gas: 1000000 });

      poolTotal = await dm[4].erc20Facet.methods.totalSupply().call();
      expect(poolTotal).to.eq(parseEther("20"));

      tokensUser = await dm[4].erc20Facet.methods
        .balanceOf(web3.eth.defaultAccount)
        .call();
      expect(tokensUser).to.eq(parseEther("10"));

      await expect(
        dm[4].basketFacet.methods
          .exitPool(parseEther("15"))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 })
      ).to.be.revertedWith("subtraction overflow");
    });
    it("Join fails if it exceeds max cap", async () => {
      await validateInitialBalance(dm[5]);

      await dm[5].basketFacet.methods
        .setMaxCap(parseEther("15"))
        .send({ from: accounts[0], gas: 1000000 });

      await expect(
        dm[5].basketFacet.methods
          .joinPool(parseEther("8"))
          .send({ from: web3.eth.defaultAccount, gas: 1000000 })
      ).to.be.revertedWith("MAX_POOL_CAP_REACHED");
    });
  });
});
