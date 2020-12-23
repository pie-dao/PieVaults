import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants } from "ethers";

import LendingLogicAaveArtifact from "../artifacts/LendingLogicAave.json";
import MockAaveLendingPoolArtifact from "../artifacts/MockAaveLendingPool.json";
import { MockTokenFactory } from "../typechain/MockTokenFactory";
import { MockATokenFactory } from "../typechain/MockATokenFactory"
import { MockToken } from "../typechain/MockToken";
import { MockAToken } from "../typechain/MockAToken";
import { LendingLogicAave } from "../typechain/LendingLogicAave";
import { MockAaveLendingPool } from "../typechain/MockAaveLendingPool";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther } from "ethers/lib/utils";

chai.use(solidity);

const mintAmount = parseEther("1000000");

describe("LendingLogicAave", function() {
    this.timeout(300000000);

    let signers: Signer[];
    let account;
    let timeTraveler: TimeTraveler;
    let lendingLogic: LendingLogicAave;
    let lendingPool: MockAaveLendingPool;
    let token: MockToken;
    let aToken: MockAToken;

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(ethereum);

        const tokenFactory = new MockTokenFactory(signers[0]);
        const aTokenFactory = new MockATokenFactory(signers[0]);

        token = await tokenFactory.deploy("token", "token");
        aToken = await aTokenFactory.deploy(token.address);

        await token.mint(mintAmount, account);

        lendingPool = await deployContract(signers[0], MockAaveLendingPoolArtifact, [token.address, aToken.address]) as MockAaveLendingPool;
        lendingLogic = await deployContract(signers[0], LendingLogicAaveArtifact, [lendingPool.address, 0]) as LendingLogicAave;

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    it("Deploying with lendingPool set to the zero address should fail", async() => {
        const promise = deployContract(signers[0], LendingLogicAaveArtifact, [constants.AddressZero, 0]);
        await expect(promise).to.be.revertedWith("LENDING_POOL_INVALID");
    });

    it("lend()", async() => {
        const calls = await lendingLogic.lend(token.address, mintAmount);

        expect(calls.targets.length).to.eq(3);
        expect(calls.data.length).to.eq(3);

        await signers[0].sendTransaction({
            to: calls.targets[0],
            data: calls.data[0]
        });

        await signers[0].sendTransaction({
            to: calls.targets[1],
            data: calls.data[1]
        });

        await signers[0].sendTransaction({
            to: calls.targets[2],
            data: calls.data[2]
        });

        const tokenBalance = await token.balanceOf(account);
        const aTokenBalance = await aToken.balanceOf(account);

        expect(tokenBalance).to.eq(0);
        expect(aTokenBalance).to.eq(mintAmount);
    });

    it("unlend()", async() => {
        await token.approve(lendingPool.address, constants.MaxUint256);
        await lendingPool.deposit(token.address, mintAmount, 0);

        expect(await aToken.balanceOf(account)).to.eq(mintAmount);

        const calls = await lendingLogic.unlend(aToken.address, mintAmount);

        expect(calls.targets.length).to.eq(1);
        expect(calls.data.length).to.eq(1);

        await signers[0].sendTransaction({
            to: calls.targets[0],
            data: calls.data[0]
        })

        const tokenBalance = await token.balanceOf(account);
        const aTokenBalance = await aToken.balanceOf(account);

        expect(tokenBalance).to.eq(mintAmount);
        expect(aTokenBalance).to.eq(0);
    });

    it("exchangeRate()", async() => {
        const exchangeRate = await lendingLogic.exchangeRate(aToken.address);
        // 1 wrapped = 1
        expect(exchangeRate).to.eq( ethers.BigNumber.from("10").pow(18))
    })

    it("exchangeRateView()", async() => {
        const exchangeRate = await lendingLogic.exchangeRateView(aToken.address);
        // 1 wrapped == 1
        expect(exchangeRate).to.eq( ethers.BigNumber.from("10").pow(18))
    })

});