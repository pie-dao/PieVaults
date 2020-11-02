import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum } from "@nomiclabs/buidler";
import { Signer, constants, BigNumber, utils, Contract, BytesLike } from "ethers";

import BasketFacetArtifact from "../artifacts/BasketFacet.json";
import Erc20FacetArtifact from "../artifacts/ERC20Facet.json";
import { Erc20Facet, BasketFacet, DiamondFactoryContract, TestToken } from "../typechain";
import {IExperiPieFactory} from "../typechain/IExperiPieFactory";
import {IExperiPie} from "../typechain/IExperiPie";
import TimeTraveler from "../utils/TimeTraveler";

chai.use(solidity);

const FacetCutAction = {
    Add: 0,
    Replace: 1,
    Remove: 2,
};

function getSelectors(contract: Contract) {
    const signatures: BytesLike[] = [];
    for(const key of Object.keys(contract.functions)) {
        signatures.push(utils.keccak256(utils.toUtf8Bytes(key)).substr(0, 10));
    }

    return signatures;
}

const NAME = "TEST POOL";
const SYMBOL = "TPL";

describe("ERC20Facet", function() {
    this.timeout(300000);

    let experiPie: IExperiPie;
    let account: string;
    let account2: string;
    let signers: Signer[];
    let timeTraveler: TimeTraveler;

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        account2 = await signers[1].getAddress();
        timeTraveler = new TimeTraveler(ethereum);

        const diamondFactory = (await run("deploy-diamond-factory")) as DiamondFactoryContract;
        
        const basketFacet = (await deployContract(signers[0], BasketFacetArtifact)) as BasketFacet;
        const erc20Facet = (await deployContract(signers[0], Erc20FacetArtifact)) as Erc20Facet;

        await diamondFactory.deployNewDiamond(
            account,
            [
                {
                    action: FacetCutAction.Add,
                    facetAddress: erc20Facet.address,
                    functionSelectors: getSelectors(erc20Facet)
                }
            ]
        )


        const experiPieAddress = await diamondFactory.diamonds(0);
        experiPie = IExperiPieFactory.connect(experiPieAddress, signers[0]);
        await experiPie.initialize(0, NAME, SYMBOL);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    describe("token metadata", async () => {
        it("Should have 18 decimals", async () => {
          const decimals = await experiPie.decimals();
          expect(decimals).to.equal(18);
        });
        it("Token name should be correct", async () => {
          const name = await experiPie.name();
          expect(name).to.eq(NAME);
        });
        it("Symbol should be correct", async () => {
          const symbol = await experiPie.symbol();
          expect(symbol).to.eq(SYMBOL);
        });
        it("Initial supply should be zero", async () => {
          const totalSupply = await experiPie.totalSupply();
          expect(totalSupply).to.eq(0);
        });
        it("After minting total supply should go up by minted amount", async () => {
          const mintAmount = constants.WeiPerEther.mul(2);
          // Mint in two tx to check if that works
          await experiPie.mint(account, mintAmount.div(2));
          await experiPie.mint(account, mintAmount.div(2));
    
          const totalSupply = await experiPie.totalSupply();
          expect(totalSupply).to.eq(mintAmount);
        });
        it("Burning tokens should lower the total supply", async () => {
          const mintAmount = constants.WeiPerEther.mul(2);
          await experiPie.mint(account, mintAmount);
          await experiPie.burn(account, mintAmount.div(2));
          const totalSupply = await experiPie.totalSupply();
          expect(totalSupply).to.eq(mintAmount.div(2));
        });
        it("Burning more than an address's balance should fail", async () => {
          const mintAmount = constants.WeiPerEther;
          await experiPie.mint(account, mintAmount);
          await expect(experiPie.burn(account, constants.WeiPerEther.add(1))).to.be.revertedWith(
            "subtraction overflow"
          );
        });
      });
      describe("balanceOf", async () => {
        it("Should return zero if no balance", async () => {
          const balance = await experiPie.balanceOf(account);
          expect(balance).to.eq(0);
        });
        it("Should return correct amount if account has some tokens", async () => {
          const mintAmount = constants.WeiPerEther.mul(2);
          await experiPie.mint(account, mintAmount);
          const balance = await experiPie.balanceOf(account);
          expect(balance).to.eq(mintAmount);
        });
      });
    describe("transfer", async () => {
        it("Should fail when the sender does not have enought balance", async () => {
          await experiPie.mint(account, constants.WeiPerEther);
          await expect(experiPie.transfer(account2, constants.WeiPerEther.add(1))).to.be.revertedWith(
            "subtraction overflow"
          );
        });
        it("Sending the entire balance should work", async () => {
          await experiPie.mint(account, constants.WeiPerEther);
          await experiPie.transfer(account2, constants.WeiPerEther);
    
          const accountBalance = await experiPie.balanceOf(account);
          const account2Balance = await experiPie.balanceOf(account2);
    
          expect(accountBalance).to.eq(0);
          expect(account2Balance).to.eq(constants.WeiPerEther);
        });
        it("Should emit transfer event", async () => {
          await experiPie.mint(account, constants.WeiPerEther);
          await expect(experiPie.transfer(account2, constants.WeiPerEther))
            .to.emit(experiPie, "Transfer")
            .withArgs(account, account2, constants.WeiPerEther);
        });
        it("Sending 0 tokens should work", async () => {
          await experiPie.mint(account, constants.WeiPerEther);
          await experiPie.transfer(account2, constants.Zero);
    
          const accountBalance = await experiPie.balanceOf(account);
          const account2Balance = await experiPie.balanceOf(account2);
    
          expect(accountBalance).to.eq(constants.WeiPerEther);
          expect(account2Balance).to.eq(0);
        });
    });
    describe("approve", async () => {
        it("Should emit event", async () => {
          await expect(experiPie.approve(account2, constants.WeiPerEther))
            .to.emit(experiPie, "Approval")
            .withArgs(account, account2, constants.WeiPerEther);
        });
        it("Should work when there was no approved amount before", async () => {
          await experiPie.approve(account2, constants.WeiPerEther);
          const approvalAmount = await experiPie.allowance(account, account2);
          expect(approvalAmount).to.eq(constants.WeiPerEther);
        });
        it("Should work when there was a approved amount before", async () => {
          await experiPie.approve(account2, constants.WeiPerEther);
          await experiPie.approve(account2, constants.WeiPerEther.mul(2));
          const approvalAmount = await experiPie.allowance(account, account2);
          expect(approvalAmount).to.eq(constants.WeiPerEther.mul(2));
        });
        it("Setting approval back to zero should work", async () => {
          await experiPie.approve(account2, constants.WeiPerEther);
          await experiPie.approve(account2, 0);
        });
    });
    describe("transferFrom", async () => {
        beforeEach(async () => {
          await experiPie.mint(account, constants.WeiPerEther);
        });
        it("Should emit event", async () => {
          await experiPie.approve(account2, constants.WeiPerEther);
          await expect(experiPie.connect(signers[1]).transferFrom(account, account2, constants.WeiPerEther))
            .to.emit(experiPie, "Transfer")
            .withArgs(account, account2, constants.WeiPerEther);
        });
        it("Should work when sender has enough balance and approved spender", async () => {
          await experiPie.approve(account2, constants.WeiPerEther);
          await experiPie.connect(signers[1]).transferFrom(account, account2, constants.WeiPerEther);
    
          const accountBalance = await experiPie.balanceOf(account);
          const account2Balance = await experiPie.balanceOf(account2);
          const approvalAmount = await experiPie.allowance(account, account2);
    
          expect(accountBalance).to.eq(constants.Zero);
          expect(account2Balance).to.eq(constants.WeiPerEther);
          expect(approvalAmount).to.eq(constants.Zero);
        });
        it("Should fail when not enough allowance is set", async () => {
          await experiPie.approve(account2, constants.WeiPerEther.sub(1));
          await expect(
            experiPie.connect(signers[1]).transferFrom(account, account2, constants.WeiPerEther)
          ).to.be.revertedWith("subtraction overflow");
        });
        it("Should fail when sender does not have enough balance", async () => {
          await experiPie.approve(account2, constants.WeiPerEther.add(1));
          await expect(
            experiPie.connect(signers[1]).transferFrom(account, account2, constants.WeiPerEther.add(1))
          ).to.be.revertedWith("subtraction overflow");
        });
        it("Should not change approval amount when it was set to max uint256", async () => {
          await experiPie.approve(account2, constants.MaxUint256);
          await experiPie.connect(signers[1]).transferFrom(account, account2, constants.WeiPerEther);
          const approvalAmount = await experiPie.allowance(account, account2);
          expect(approvalAmount).to.eq(constants.MaxUint256);
        });
    });
})