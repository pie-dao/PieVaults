/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */
const { parseEther } = require('ethers/lib/utils')
const { expect } = require('chai')
const { use } = require('chai')
const { solidity } = require('ethereum-waffle');
use(solidity);
const Diamond = artifacts.require('Diamond')
const DiamondCutFacet = artifacts.require('DiamondCutFacet')
const DiamondLoupeFacet = artifacts.require('DiamondLoupeFacet')
const BasketFacet = artifacts.require('BasketFacet')
const ERC20Facet = artifacts.require('ERC20Facet')
const ERC20Factory = artifacts.require('ERC20Factory')
const ERC20 = artifacts.require('ERC20')
let zeroAddress = '0x0000000000000000000000000000000000000000'
contract('BasketFacetTest', async accounts => {
    let diamond;
    let diamondCutFacet
    let diamondLoupeFacet
    let basketFacet;
    let erc20Facet;
    let erc20Factory;
    let tokens = [];

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

    const waitNBlocks = async n => {
      //const sendAsync = promisify(web3.currentProvider.sendAsync);
      await Promise.all(
        [...Array(n).keys()].map(i =>
          web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_mine',
            params: [],
            id: new Date().getTime(),
          }, () => { })
        )
      );
    };

    before(async () => {
        web3.eth.defaultAccount = accounts[0]
        diamond = await Diamond.deployed()
        diamondCutFacet = new web3.eth.Contract(DiamondCutFacet.abi, diamond.address)
        diamondLoupeFacet = new web3.eth.Contract(DiamondLoupeFacet.abi, diamond.address)
        basketFacet = await BasketFacet.deployed()
        erc20Facet = await ERC20Facet.deployed()
        erc20Factory = await ERC20Factory.deployed()

        // Attach basketFacet to diamond
        selectors = getSelectors(basketFacet)
        await diamondCutFacet.methods.diamondCut(
          [[basketFacet.address, selectors]], zeroAddress, '0x'
        ).send({ from: web3.eth.defaultAccount, gas: 1000000 })

        // Attach erc20facet to diamond
        selectors = getSelectors(erc20Facet)
        await diamondCutFacet.methods.diamondCut(
          [[erc20Facet.address, selectors]], zeroAddress, '0x'
        ).send({ from: web3.eth.defaultAccount, gas: 1000000 })

        // Reinitialize both basketFacet and erc20Facet.
        // Using the diamond address
        basketFacet = new web3.eth.Contract(BasketFacet.abi, diamond.address);
        erc20Facet = new web3.eth.Contract(ERC20Facet.abi, diamond.address);

        tokens = []
        for (let i = 0; i < 3; i++) {
          token = await erc20Factory.deployNewToken("TEST ${i}", "TST${i}", parseEther("2000"), web3.eth.defaultAccount)
          address = token.receipt.rawLogs[0].address;

          token = new web3.eth.Contract(ERC20.abi, address);
          await token.methods.transfer(accounts[2], parseEther("1000")).send({
            from: web3.eth.defaultAccount, gas: 1000000
          })

          await token.methods.approve(diamond.address, parseEther("100000000")).send(
            {from: web3.eth.defaultAccount, gas: 1000000}
          )
          await token.methods.approve(diamond.address, parseEther("100000000")).send(
            {from: accounts[2], gas: 1000000}
          )
          tokens.push(token)
        }
    });
    describe("MaxCap", async() => {
      it('Check default cap', async () => {
        maxCap = await basketFacet.methods.getMaxCap().call();
        expect(maxCap).to.be.eq("0");
      });
      it('Test setlock not allowed', async () => {
        await expect (
          basketFacet.methods.setMaxCap(parseEther("1000")).send(
            {from: accounts[1], gas: 1000000}
          )
        ).to.be.revertedWith("NOT_ALLOWED")
      });
      it('Set lock', async () => {
        await basketFacet.methods.setMaxCap(parseEther("100")).send(
          {from: accounts[0], gas: 1000000}
        )
        maxCap = await basketFacet.methods.getMaxCap().call();
        expect(maxCap).to.be.eq(parseEther("100"));
      });
    });
    describe("Lock", async() => {
      it('Check default locked', async () => {
        lock = await basketFacet.methods.getLock().call();
        assert.equal(lock, true);
      });
      it('Test setlock not allowed', async () => {
        await expect (
          basketFacet.methods.setLock(1).send(
            {from: accounts[1], gas: 1000000}
          )
        ).to.be.revertedWith("NOT_ALLOWED")
      });
      it('Check past lock', async () => {
        // set blockNumber to at least 2
        await waitNBlocks(2);

        // set lock in the past
        await basketFacet.methods.setLock(1).send({from: web3.eth.defaultAccount, gas: 1000000});
        lock = await basketFacet.methods.getLock().call();
        assert.equal(lock, false);
      });
      it('Check future lock', async () => {
        latestBlock = await web3.eth.getBlockNumber();
        // set lock in the future
        await basketFacet.methods.setLock(latestBlock + 1).send({from: web3.eth.defaultAccount, gas: 1000000});
        lock = await basketFacet.methods.getLock().call();
        assert.equal(lock, true);
      });
      it('Check current block lock', async () => {
        // assert lock == currentblock
        assert.equal(await web3.eth.getBlockNumber(), latestBlock + 1);

        // should still be locked (block is including)
        lock = await basketFacet.methods.getLock().call();
        assert.equal(lock, true);
      });
      it('Wait for lock expires', async () => {
        await waitNBlocks(1);
        assert.equal(await web3.eth.getBlockNumber(), latestBlock + 2);

        // should be unlocked
        lock = await basketFacet.methods.getLock().call();
        assert.equal(lock, false);
      })
    });


    describe("Initalize", async() => {
      it('Not enough pool balance', async () => {
        await expect(
          basketFacet.methods.initialize(
            [tokens[0].options.address], parseEther("10")
          ).send({from: web3.eth.defaultAccount, gas: 1000000})
        ).to.be.revertedWith("POOL_TOKEN_BALANCE_TOO_LOW");
      })
      it('Not enough token balance', async () => {
        await erc20Facet.methods.initialize(
          parseEther("10"), "TEST 1", "TST1", 18
        ).send({from: web3.eth.defaultAccount, gas: 1000000});

        await expect(
          basketFacet.methods.initialize(
            [tokens[0].options.address], parseEther("5")
          ).send({from: web3.eth.defaultAccount, gas: 1000000})
        ).to.be.revertedWith("MAX_POOL_CAP_REACHED");
      });
      it('Not enough token balance', async () => {
        await expect(
          basketFacet.methods.initialize(
            [tokens[0].options.address], parseEther("1000")
          ).send({from: web3.eth.defaultAccount, gas: 1000000})
        ).to.be.revertedWith("TOKEN_BALANCE_TOO_LOW");
      })
      it('Not owner', async () => {
        await expect(
          basketFacet.methods.initialize(
            [], parseEther("1000")
          ).send({from: accounts[1], gas: 1000000})
        ).to.be.revertedWith("Must own the contract.");
      })
      it('Initialize successful', async () => {
        // set lock
        await basketFacet.methods.setLock(0).send(
          {from: web3.eth.defaultAccount, gas: 1000000}
        );

        addresses = []
        for (var i = 0; i < tokens.length; i++) {
          await tokens[i].methods.transfer(diamond.address, parseEther("100")).send(
            {from: web3.eth.defaultAccount, gas: 1000000}
          )
          addresses.push(tokens[i].options.address)
        }

        lock = await basketFacet.methods.getLock().call();
        assert.equal(lock, true);

        // finaly initialize pool
        await basketFacet.methods.initialize(
          addresses, parseEther("50000")
        ).send({from: web3.eth.defaultAccount, gas: 1000000})

        lock = await basketFacet.methods.getLock().call();
        assert.equal(lock, false);
      })
    })

    describe("Joining and exiting", async() => {
        // transfer initial token liquidity
        before(async () => {
          latestBlock = await web3.eth.getBlockNumber();
        });

        it('Test locks', async () => {
            await basketFacet.methods.setLock(latestBlock + 5).send({
              from: web3.eth.defaultAccount, gas: 1000000
            })

            await expect(
              basketFacet.methods.joinPool(
                parseEther("1")
              ).send({from: web3.eth.defaultAccount, gas: 1000000})
            ).to.be.revertedWith("POOL_LOCKED");

            await expect(
              basketFacet.methods.exitPool(
                parseEther("1")
              ).send({from: web3.eth.defaultAccount, gas: 1000000})
            ).to.be.revertedWith("POOL_LOCKED");

            // skip for oncoming tests
            await waitNBlocks(5);
        })
        it('Join pool', async () => {
          for (var i = 0; i < tokens.length; i++) {
            balanceDiamond = await tokens[i].methods.balanceOf(diamond.address).call()
            expect(balanceDiamond).to.eq(parseEther("100"))

            // validate internal balance call
            balanceDiamondInternal = await basketFacet.methods.balance(tokens[i].options.address).call()
            expect(balanceDiamondInternal).to.eq(balanceDiamond)

            balanceUser = await tokens[i].methods.balanceOf(web3.eth.defaultAccount).call()
            expect(balanceUser).to.eq(parseEther("900"))
          }
          // if this line fail, please run the initialize tests
          tokensUser = await erc20Facet.methods.balanceOf(web3.eth.defaultAccount).call()
          expect(tokensUser).to.eq(parseEther("10"))

          await basketFacet.methods.joinPool(
            parseEther("10")
          ).send({from: web3.eth.defaultAccount, gas: 1000000})

          for (var i = 0; i < tokens.length; i++) {
            balanceDiamond = await tokens[i].methods.balanceOf(diamond.address).call()
            expect(balanceDiamond).to.eq(parseEther("200"))

            balanceUser = await tokens[i].methods.balanceOf(web3.eth.defaultAccount).call()
            expect(balanceUser).to.eq(parseEther("800"))
          }
          tokensUser = await erc20Facet.methods.balanceOf(web3.eth.defaultAccount).call()
          expect(tokensUser).to.eq(parseEther("20"))
        })
        it('Exit pool', async () => {
          await basketFacet.methods.exitPool(
            parseEther("5")
          ).send({from: web3.eth.defaultAccount, gas: 1000000})
          for (var i = 0; i < tokens.length; i++) {
            balanceDiamond = await tokens[i].methods.balanceOf(diamond.address).call()
            expect(balanceDiamond).to.eq(parseEther("150"))

            balanceUser = await tokens[i].methods.balanceOf(web3.eth.defaultAccount).call()
            expect(balanceUser).to.eq(parseEther("850"))
          }
          tokensUser = await erc20Facet.methods.balanceOf(web3.eth.defaultAccount).call()
          expect(tokensUser).to.eq(parseEther("15"))
        })
        it('Join fails if it exceeds balance', async () => {
          await expect(
            basketFacet.methods.joinPool(
              parseEther("10000")
            ).send({from: web3.eth.defaultAccount, gas: 1000000})
          ).to.be.revertedWith("transfer amount exceeds balance")
        })
        it('Exit fails if it exceeds MIN_AMOUNT', async () => {
          tokensUser = await erc20Facet.methods.balanceOf(web3.eth.defaultAccount).call()
          expect(tokensUser).to.eq(parseEther("15"))

          await expect(
            basketFacet.methods.exitPool(
              parseEther("15").sub(1)
            ).send({from: web3.eth.defaultAccount, gas: 1000000})
          ).to.be.revertedWith("TOKEN_BALANCE_TOO_LOW")
        })
        it('Join pool with another account', async () => {
          poolTotal = await erc20Facet.methods.totalSupply().call()
          expect(poolTotal).to.eq(parseEther("15"))

          await basketFacet.methods.joinPool(
            parseEther("15")
          ).send({from: accounts[2], gas: 1000000})

          for (var i = 0; i < tokens.length; i++) {
            balanceDiamond = await tokens[i].methods.balanceOf(diamond.address).call()
            expect(balanceDiamond).to.eq(parseEther("300"))

            balanceUser = await tokens[i].methods.balanceOf(accounts[2]).call()
            expect(balanceUser).to.eq(parseEther("850"))
          }
          tokensUser = await erc20Facet.methods.balanceOf(accounts[2]).call()
          expect(tokensUser).to.eq(parseEther("15"))
        })
        it('Exit fails if it exceeds balance of user', async () => {
          poolTotal = await erc20Facet.methods.totalSupply().call()
          expect(poolTotal).to.eq(parseEther("30"))

          await expect(
             basketFacet.methods.exitPool(
              parseEther("20")
             ).send({from: web3.eth.defaultAccount, gas: 1000000})
          ).to.be.revertedWith("subtraction overflow")
        })
        it('Join fails if it exceeds max cap', async () => {
          poolTotal = await erc20Facet.methods.totalSupply().call()
          expect(poolTotal).to.eq(parseEther("30"))

          tokensUser = await erc20Facet.methods.balanceOf(web3.eth.defaultAccount).call()
          expect(tokensUser).to.eq(parseEther("15"))

          await basketFacet.methods.setMaxCap(parseEther("35")).send(
            {from: accounts[0], gas: 1000000}
          )

          await expect(
            basketFacet.methods.joinPool(
              parseEther("10")
            ).send({from: web3.eth.defaultAccount, gas: 1000000})
          ).to.be.revertedWith("MAX_POOL_CAP_REACHED")
        })
    })
});