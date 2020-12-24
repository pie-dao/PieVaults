import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants } from "ethers";

import LendingLogicAaveV2Artifact from "../artifacts/LendingLogicAaveV2.json";
import MockAaveLendingPoolV2Artifact from "../artifacts/MockAaveLendingPoolV2.json";
import { MockTokenFactory } from "../typechain/MockTokenFactory";
import { MockATokenV2Factory } from "../typechain/MockATokenV2Factory"
import { MockToken } from "../typechain/MockToken";
import { MockATokenV2 } from "../typechain/MockATokenV2";
import { LendingLogicAaveV2 } from "../typechain/LendingLogicAaveV2";
import { MockAaveLendingPoolV2 } from "../typechain/MockAaveLendingPoolV2";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther } from "ethers/lib/utils";

chai.use(solidity);

const mintAmount = parseEther("1000000");

describe("LendingLogicAaveV2", function() {
    this.timeout(300000000);

    let signers: Signer[];
    let account;
    let timeTraveler: TimeTraveler;
    let lendingLogic: LendingLogicAaveV2;
    let lendingPool: MockAaveLendingPoolV2;
    let token: MockToken;
    let aToken: MockATokenV2;

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(ethereum);

        const tokenFactory = new MockTokenFactory(signers[0]);
        const aTokenFactory = new MockATokenV2Factory(signers[0]);

        token = await tokenFactory.deploy("token", "token");
        aToken = await aTokenFactory.deploy(token.address);

        await token.mint(mintAmount, account);

        lendingPool = await deployContract(signers[0], MockAaveLendingPoolV2Artifact, [token.address, aToken.address]) as MockAaveLendingPoolV2;
        lendingLogic = await deployContract(signers[0], LendingLogicAaveV2Artifact,
            [lendingPool.address, 0, account]) as LendingLogicAaveV2;

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    it("Deploying with lendingPool set to the zero address should fail", async() => {
        const promise = deployContract(signers[0], LendingLogicAaveV2Artifact, [constants.AddressZero, 0, account]);
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
        await lendingPool.deposit(token.address, mintAmount, account, 0);

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

    it("getAPRFromUnderlying()", async() => {
        const reserveData = await lendingPool.getReserveData(token.address);
        expect(reserveData.currentLiquidityRate).to.eq(ethers.BigNumber.from("10").pow(25)) // one percent

        const apr = await lendingLogic.getAPRFromUnderlying(token.address);
        expect(apr).to.eq(ethers.BigNumber.from("10").pow(16)) // one percent
    })

    it("getAPRFromWrapped()", async() => {
        const apr = await lendingLogic.getAPRFromWrapped(aToken.address);
        expect(apr).to.eq(ethers.BigNumber.from("10").pow(16)) // one percent
    })

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