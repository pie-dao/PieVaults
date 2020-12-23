import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants } from "ethers";

import StakingLogicYGovArtifact from "../artifacts/StakingLogicYGov.json";

import { MockTokenFactory } from "../typechain/MockTokenFactory";
import { MockYVaultFactory } from "../typechain/MockYVaultFactory";
import { MockToken } from "../typechain/MockToken";
import { MockYVault } from "../typechain/MockYVault";
import { StakingLogicYGov } from "../typechain/StakingLogicYGov";

import { LendingRegistry } from "../typechain";
import { LendingRegistryFactory } from "../typechain";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther, formatBytes32String } from "ethers/lib/utils";


chai.use(solidity);

const mintAmount = parseEther("1000000");
// keccak("yGOV");
const PLACEHOLDER_PROTOCOL = "0xf910d6d870f2fa35287ad95c43b0b1ebabfab3cbb469515dc168cd48e2a9c218";

describe("StakingLogicYGov", function() {
    this.timeout(300000000);

    let signers: Signer[];
    let account;
    let timeTraveler: TimeTraveler;
    let lendingLogic: StakingLogicYGov;
    let lendingRegistry: LendingRegistry;
    let token: MockToken;
    let yGov: MockYVault;

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(ethereum);
        
        const tokenFactory = new MockTokenFactory(signers[0]);
        const yGOVFactory = new MockYVaultFactory(signers[0]);

        token = await tokenFactory.deploy("token", "token");
        yGov = await yGOVFactory.deploy(token.address);

        await token.mint(mintAmount, account);

        lendingRegistry = await (new LendingRegistryFactory(signers[0])).deploy();
        lendingLogic = await deployContract(signers[0], StakingLogicYGovArtifact, [lendingRegistry.address]) as StakingLogicYGov;
        
        await lendingRegistry.setProtocolToLogic(PLACEHOLDER_PROTOCOL, lendingLogic.address);
        await lendingRegistry.setWrappedToProtocol(yGov.address, PLACEHOLDER_PROTOCOL);
        await lendingRegistry.setUnderlyingToProtocolWrapped(token.address, PLACEHOLDER_PROTOCOL, yGov.address);
        
        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    it("Deploying with the lending registry to the zero address should fail", async() => {
        const promise = deployContract(signers[0], StakingLogicYGovArtifact, [constants.AddressZero]);
        await expect(promise).to.be.revertedWith("INVALID_LENDING_REGISTRY");
    });

    it("deposit()", async() => {
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
        const yGovBalance = await yGov.balanceOf(account);

        expect(tokenBalance).to.eq(0);
        expect(yGovBalance).to.eq(mintAmount.mul(5));
    });

    it("withdraw()", async() => {
        await token.approve(yGov.address, constants.MaxUint256);
        await yGov["mint(uint256)"](mintAmount);

        expect(await yGov.balanceOf(account)).to.eq(mintAmount.mul(5));

        const calls = await lendingLogic.unlend(yGov.address, mintAmount.mul(5));

        expect(calls.targets.length).to.eq(1);
        expect(calls.data.length).to.eq(1);
        
        await signers[0].sendTransaction({
            to: calls.targets[0],
            data: calls.data[0]
        })

        const tokenBalance = await token.balanceOf(account);
        const yGovBalance = await yGov.balanceOf(account);

        expect(tokenBalance).to.eq(mintAmount);
        expect(yGovBalance).to.eq(0);
    });

});