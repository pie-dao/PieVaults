import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants } from "ethers";

import LendingLogicCompoundArtifact from "../artifacts/LendingLogicCompound.json";

import { MockTokenFactory } from "../typechain/MockTokenFactory";
import { MockCTokenFactory } from "../typechain/MockCTokenFactory";
import { MockToken } from "../typechain/MockToken";
import { MockCToken } from "../typechain/MockCToken";
import { LendingLogicCompound } from "../typechain/LendingLogicCompound";

import { LendingRegistry } from "../typechain";
import { LendingRegistryFactory } from "../typechain";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther, formatBytes32String } from "ethers/lib/utils";


chai.use(solidity);

const mintAmount = parseEther("1000000");
// keccak("Compound");
const PLACEHOLDER_PROTOCOL = "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

describe("LendingLogicCompound", function() {
    this.timeout(300000000);

    let signers: Signer[];
    let account;
    let timeTraveler: TimeTraveler;
    let lendingLogic: LendingLogicCompound;
    let lendingRegistry: LendingRegistry;
    let token: MockToken;
    let cToken: MockCToken;

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(ethereum);

        const tokenFactory = new MockTokenFactory(signers[0]);
        const cTokenFactory = new MockCTokenFactory(signers[0]);

        token = await tokenFactory.deploy("token", "token");
        cToken = await cTokenFactory.deploy(token.address);

        await token.mint(mintAmount, account);

        lendingRegistry = await (new LendingRegistryFactory(signers[0])).deploy();
        lendingLogic = await deployContract(signers[0], LendingLogicCompoundArtifact, [lendingRegistry.address, PLACEHOLDER_PROTOCOL]) as LendingLogicCompound;

        await lendingRegistry.setProtocolToLogic(PLACEHOLDER_PROTOCOL, lendingLogic.address);
        await lendingRegistry.setWrappedToProtocol(cToken.address, PLACEHOLDER_PROTOCOL);
        await lendingRegistry.setUnderlyingToProtocolWrapped(token.address, PLACEHOLDER_PROTOCOL, cToken.address);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    it("Deploying with the lending registry to the zero address should fail", async() => {
        const promise = deployContract(signers[0], LendingLogicCompoundArtifact, [constants.AddressZero, PLACEHOLDER_PROTOCOL]);
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
        const cTokenBalance = await cToken.balanceOf(account);

        expect(tokenBalance).to.eq(0);
        expect(cTokenBalance).to.eq(mintAmount.mul(5));
    });

    it("unlend()", async() => {
        await token.approve(cToken.address, constants.MaxUint256);
        await cToken["mint(uint256)"](mintAmount);

        expect(await cToken.balanceOf(account)).to.eq(mintAmount.mul(5));

        const calls = await lendingLogic.unlend(cToken.address, mintAmount.mul(5));

        expect(calls.targets.length).to.eq(1);
        expect(calls.data.length).to.eq(1);

        await signers[0].sendTransaction({
            to: calls.targets[0],
            data: calls.data[0]
        })

        const tokenBalance = await token.balanceOf(account);
        const cTokenBalance = await cToken.balanceOf(account);

        expect(tokenBalance).to.eq(mintAmount);
        expect(cTokenBalance).to.eq(0);
    });

    it("exchangeRate()", async() => {
        await cToken.exchangeRateCurrent()
        await lendingLogic.exchangeRate(cToken.address);
    })

    it("exchangeRateView()", async() => {
        const exchangeRate = await cToken.exchangeRateStored()
        // 1 wrapped (8 decimals) = 0.2 (8 decimals)
        expect(exchangeRate).to.eq(ethers.BigNumber.from("10").pow(17).mul(2))
        const exchangeRateLending = await lendingLogic.exchangeRateView(cToken.address);
        expect(exchangeRate).to.eq(exchangeRateLending)
    })

});