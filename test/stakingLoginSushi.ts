import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants } from "ethers";

import StakingLogicSushiArtifact from "../artifacts/StakingLogicSushi.json";

import { MockTokenFactory } from "../typechain/MockTokenFactory";
import { MockXSushiFactory } from "../typechain/MockXSushiFactory";
import { MockToken } from "../typechain/MockToken";
import { MockXSushi } from "../typechain/MockXSushi";
import { StakingLogicSushi } from "../typechain/StakingLogicSushi";

import { LendingRegistry } from "../typechain";
import { LendingRegistryFactory } from "../typechain";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther, formatBytes32String } from "ethers/lib/utils";


chai.use(solidity);

const mintAmount = parseEther("1000000");
// keccak("xSUSHI");
const PLACEHOLDER_PROTOCOL = "0xeafaa563273a4fdf984f5a9f1836dba7d5800658b802d449eb6ee18fce3d7c81";

describe("StakingLogicSushi", function() {
    this.timeout(300000000);

    let signers: Signer[];
    let account;
    let timeTraveler: TimeTraveler;
    let lendingLogic: StakingLogicSushi;
    let lendingRegistry: LendingRegistry;
    let token: MockXSushi;
    let cToken: MockXSushi;

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(ethereum);
        
        const tokenFactory = new MockTokenFactory(signers[0]);
        const cTokenFactory = new MockXSushiFactory(signers[0]);

        token = await tokenFactory.deploy("token", "token");
        cToken = await cTokenFactory.deploy(token.address);

        await token.mint(mintAmount, account);

        lendingRegistry = await (new LendingRegistryFactory(signers[0])).deploy();
        lendingLogic = await deployContract(signers[0], StakingLogicSushiArtifact, [lendingRegistry.address]) as StakingLogicSushi;
        
        await lendingRegistry.setProtocolToLogic(PLACEHOLDER_PROTOCOL, lendingLogic.address);
        await lendingRegistry.setWrappedToProtocol(cToken.address, PLACEHOLDER_PROTOCOL);
        await lendingRegistry.setUnderlyingToProtocolWrapped(token.address, PLACEHOLDER_PROTOCOL, cToken.address);
        
        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    it("Deploying with the lending registry to the zero address should fail", async() => {
        const promise = deployContract(signers[0], StakingLogicSushiArtifact, [constants.AddressZero]);
        await expect(promise).to.be.revertedWith("INVALID_LENDING_REGISTRY");
    });

    it("enter()", async() => {
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

    it("exit()", async() => {
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

});