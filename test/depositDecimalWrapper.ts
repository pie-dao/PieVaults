import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants } from "ethers";

import DepositLogicDecimalWrapperArtifact from "../artifacts/DepositLogicDecimalWrapper.json";
import { MockTokenFactory } from "../typechain/MockTokenFactory";
import { MockToken } from "../typechain/MockToken";
import { MockDecimalWrapper } from "../typechain/MockDecimalWrapper";
import { LendingLogicAave } from "../typechain/LendingLogicAave";
import { MockAaveLendingPool } from "../typechain/MockAaveLendingPool";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther } from "ethers/lib/utils";
import { DepositLogicDecimalWrapper, LendingRegistry, LendingRegistryFactory, MockDecimalWrapperFactory } from "../typechain";
import { isTryStatement } from "typescript";

chai.use(solidity);

const mintAmount = parseEther("1000000");
const CONVERSION = parseEther("1");
// random key
const WRAPPER = "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a114476aaa";

describe.only("DepositDecimalWrapper", function() {
    this.timeout(300000000);

    let signers: Signer[];
    let account;
    let timeTraveler: TimeTraveler;
    let lendingLogic: DepositLogicDecimalWrapper;
    let lendingRegistry: LendingRegistry;
    let token: MockToken;
    let decimalWrapper: MockDecimalWrapper;

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(ethereum);

        const tokenFactory = new MockTokenFactory(signers[0]);
        const decimalWrapperFactory = new MockDecimalWrapperFactory(signers[0]);

        token = await tokenFactory.deploy("token", "token");
        decimalWrapper = await decimalWrapperFactory.deploy("WRAP", "WRAP", token.address, CONVERSION);

        await token.mint(mintAmount, account);

        lendingRegistry = await (new LendingRegistryFactory(signers[0])).deploy();

        lendingLogic = await deployContract(signers[0], DepositLogicDecimalWrapperArtifact, [lendingRegistry.address, WRAPPER]) as unknown as DepositLogicDecimalWrapper;

        // Add lendingLogic to lending Registry
        await lendingRegistry.setProtocolToLogic(WRAPPER, lendingLogic.address);
        await lendingRegistry.setUnderlyingToProtocolWrapped(token.address, WRAPPER, decimalWrapper.address);
        await lendingRegistry.setWrappedToProtocol(decimalWrapper.address, WRAPPER);
        await lendingRegistry.setWrappedToUnderlying(decimalWrapper.address, token.address);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    it("Deploying with lendingRegistry set to the zero address should fail", async() => {
        const promise = deployContract(signers[0], DepositLogicDecimalWrapperArtifact, [constants.AddressZero, WRAPPER]);
        await expect(promise).to.be.revertedWith("INVALID_LENDING_REGISTRY");
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
        const decimalWrapperBalance = await decimalWrapper.balanceOf(account);

        expect(tokenBalance).to.eq(0);
        expect(decimalWrapperBalance).to.eq(mintAmount.mul(CONVERSION));
    });

    it("unlend()", async() => {
        await token.approve(decimalWrapper.address, constants.MaxUint256);
        await decimalWrapper.deposit(mintAmount);

        expect(await decimalWrapper.balanceOf(account)).to.eq(mintAmount.mul(CONVERSION));

        const calls = await lendingLogic.unlend(decimalWrapper.address, mintAmount.mul(CONVERSION));

        expect(calls.targets.length).to.eq(1);
        expect(calls.data.length).to.eq(1);

        await signers[0].sendTransaction({
            to: calls.targets[0],
            data: calls.data[0]
        })

        const tokenBalance = await token.balanceOf(account);
        const decimalWrapperBalance = await decimalWrapper.balanceOf(account);

        expect(tokenBalance).to.eq(mintAmount);
        expect(decimalWrapperBalance).to.eq(0);
    });

    it("getAPRFromUnderlying()", async() => {
        const apr = await lendingLogic.getAPRFromUnderlying(token.address);
        expect(apr).to.eq(0)
    });

    it("getAPRFromWrapped()", async() => {
        const apr = await lendingLogic.getAPRFromWrapped(decimalWrapper.address);
        expect(apr).to.eq(0) // one percent
    });
    
    it("exchangeRate()", async() => {
        const exchangeRate = await lendingLogic.callStatic.exchangeRate(decimalWrapper.address);
        // 1 wrapped = 1e18
        expect(exchangeRate).to.eq(parseEther("1").div(CONVERSION));
    })

    it("exchangeRateView()", async() => {
        const exchangeRate = await lendingLogic.exchangeRateView(decimalWrapper.address);
        // 1 wrapped = 1e18
        expect(exchangeRate).to.eq(parseEther("1").div(CONVERSION));
    });

    it.only("Deposit based on exchangeRate", async() => {
        const exchangeRate = await lendingLogic.exchangeRateView(decimalWrapper.address);
        const targetAmount = parseEther("1");
        const depositAmount = targetAmount.mul(exchangeRate.toString()).div(parseEther("1"));

        console.log(targetAmount.toString());
        console.log(depositAmount.toString());
    });

});