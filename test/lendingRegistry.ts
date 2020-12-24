import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants, BigNumber, utils, Contract, BytesLike } from "ethers";

import LendingRegistryArtifact from "../artifacts/LendingRegistry.json";
import MockLendingLogicArtifact from "../artifacts/MockLendingLogic.json";
import { LendingRegistry } from "../typechain/LendingRegistry";
import { MockLendingLogic } from "../typechain/MockLendingLogic";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther, formatBytes32String } from "ethers/lib/utils";

chai.use(solidity);

const PLACEHOLDER_1 = "0x0000000000000000000000000000000000000001";
const PLACEHOLDER_2 = "0x0000000000000000000000000000000000000002";
const PLACEHOLDER_3 = "0x0000000000000000000000000000000000000003";

const PLACEHOLDER_PROTOCOL = formatBytes32String("PROTOCOL");
const PLACEHOLDER_PROTOCOL2 = formatBytes32String("PROTOCOL2");

describe("LendingRegistry", function() {
    this.timeout(300000000);

    let account: string;
    let lendingRegistry: LendingRegistry;
    let mockLendingLogic: MockLendingLogic;
    let mockLendingLogic2: MockLendingLogic;
    let signers: Signer[];
    let timeTraveler: TimeTraveler;

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(ethereum);

        lendingRegistry = await deployContract(signers[0], LendingRegistryArtifact) as LendingRegistry;
        mockLendingLogic = await deployContract(signers[0], MockLendingLogicArtifact) as MockLendingLogic;
        mockLendingLogic2 = await deployContract(signers[0], MockLendingLogicArtifact) as MockLendingLogic;

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    describe("setWrappedToProtocol", async() => {
        it("should work", async() => {
            await lendingRegistry.setWrappedToProtocol(PLACEHOLDER_1, PLACEHOLDER_PROTOCOL);
            const result = await lendingRegistry.wrappedToProtocol(PLACEHOLDER_1);
            expect(result).to.eq(PLACEHOLDER_PROTOCOL);
        });
        it("should revert when called from non owner", async() => {
            await expect(lendingRegistry.connect(signers[1]).setWrappedToProtocol(PLACEHOLDER_1, PLACEHOLDER_PROTOCOL)).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("setWrappedToUnderlying", async() => {
        it("should work", async() => {
            await lendingRegistry.setWrappedToUnderlying(PLACEHOLDER_1, PLACEHOLDER_2);
            const result = await lendingRegistry.wrappedToUnderlying(PLACEHOLDER_1);
            expect(result).to.eq(PLACEHOLDER_2);
        });
        it("should revert when called from non owner", async() => {
            await expect(lendingRegistry.connect(signers[1]).setWrappedToUnderlying(PLACEHOLDER_1, PLACEHOLDER_2)).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("setProtocolToLogic", async() => {
        it("should work", async() => {
            await lendingRegistry.setProtocolToLogic(PLACEHOLDER_PROTOCOL, PLACEHOLDER_1);
            const result = await lendingRegistry.protocolToLogic(PLACEHOLDER_PROTOCOL);
            expect(result).to.eq(PLACEHOLDER_1);
        });
        it("should revert when called from non owner", async() => {
            await expect(lendingRegistry.connect(signers[1]).setProtocolToLogic(PLACEHOLDER_PROTOCOL, PLACEHOLDER_2)).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("setUnderlyingToProtocolWrapped", async() => {
        it("should work", async() => {
            await lendingRegistry.setUnderlyingToProtocolWrapped(PLACEHOLDER_1, PLACEHOLDER_PROTOCOL, PLACEHOLDER_2);
            const result = await lendingRegistry.underlyingToProtocolWrapped(PLACEHOLDER_1, PLACEHOLDER_PROTOCOL);
            expect(result).to.eq(PLACEHOLDER_2);
        });
        it("should revert when called from non owner", async() => {
            await expect(lendingRegistry.connect(signers[1]).setUnderlyingToProtocolWrapped(PLACEHOLDER_1, PLACEHOLDER_PROTOCOL, PLACEHOLDER_2)).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Getting tx data", async() => {
        beforeEach(async() => {
            await lendingRegistry.setProtocolToLogic(PLACEHOLDER_PROTOCOL, mockLendingLogic.address);
            await lendingRegistry.setWrappedToProtocol(PLACEHOLDER_1, PLACEHOLDER_PROTOCOL);
        });

        it("getLendTXData", async() => {
            const data = await lendingRegistry.getLendTXData(PLACEHOLDER_1, parseEther("1"), PLACEHOLDER_PROTOCOL) as any;

            expect(data.targets[0]).to.eq(PLACEHOLDER_1);
            expect(BigNumber.from(data.data[0])).to.eq(parseEther("1"));
        });

        it("getLendTxData should fail when no protocol is set", async() => {
            await lendingRegistry.setProtocolToLogic(PLACEHOLDER_PROTOCOL, constants.AddressZero);

            await expect(lendingRegistry.getLendTXData(PLACEHOLDER_1, parseEther("1"), PLACEHOLDER_PROTOCOL)).to.be.revertedWith("NO_LENDING_LOGIC_SET");
        });

        it("getUnlendTXData", async() => {
            const data = await lendingRegistry.getUnlendTXData(PLACEHOLDER_1, parseEther("1")) as any;

            expect(data.targets[0]).to.eq(PLACEHOLDER_1);
            expect(BigNumber.from(data.data[0])).to.eq(parseEther("1"));
        });

        it("getUnlendTXData should fail when no protocol is set", async() => {
            await lendingRegistry.setProtocolToLogic(PLACEHOLDER_PROTOCOL, constants.AddressZero);

            await expect(lendingRegistry.getUnlendTXData(PLACEHOLDER_1, parseEther("1"))).to.be.revertedWith("NO_LENDING_LOGIC_SET");
        });
    });

    describe("getBestApr", async() => {
        it("should return defailt values with empty protocols", async() => {
            const result = await lendingRegistry.getBestApr(PLACEHOLDER_1, []);

            expect(result.apr).to.eq(0);
            expect(result.protocol).to.eq(constants.HashZero);
        });
        it("should fail when no protocol is set", async() => {
            await expect(lendingRegistry.getBestApr(PLACEHOLDER_1, [PLACEHOLDER_PROTOCOL])).to.be.revertedWith("NO_LENDING_LOGIC_SET");
        });
        it("should return result (single protocol)", async() => {
            // underlying = PLACEHOLDER_1
            // wrapped = PLACEHOLDER_2
            const TWO_PERCENT = ethers.BigNumber.from("10").pow(16).mul(2)
            await mockLendingLogic.setAPR(TWO_PERCENT)

            await lendingRegistry.setProtocolToLogic(PLACEHOLDER_PROTOCOL, mockLendingLogic.address);
            await lendingRegistry.setUnderlyingToProtocolWrapped(PLACEHOLDER_1,  PLACEHOLDER_PROTOCOL, PLACEHOLDER_2);

            const result = await lendingRegistry.getBestApr(PLACEHOLDER_1, [PLACEHOLDER_PROTOCOL])
            expect(result.apr).to.eq(TWO_PERCENT);
            expect(result.protocol).to.eq(PLACEHOLDER_PROTOCOL);
        });
        it("should return result (multiple protocols)", async() => {
            // underlying = PLACEHOLDER_1
            // wrapped = PLACEHOLDER_2
            const TWO_PERCENT = ethers.BigNumber.from("10").pow(16).mul(2)
            await mockLendingLogic.setAPR(TWO_PERCENT)
            await mockLendingLogic2.setAPR(TWO_PERCENT.mul(2))

            await lendingRegistry.setProtocolToLogic(PLACEHOLDER_PROTOCOL, mockLendingLogic.address);
            await lendingRegistry.setProtocolToLogic(PLACEHOLDER_PROTOCOL2, mockLendingLogic2.address);

            await lendingRegistry.setUnderlyingToProtocolWrapped(PLACEHOLDER_1,  PLACEHOLDER_PROTOCOL, PLACEHOLDER_2);
            await lendingRegistry.setUnderlyingToProtocolWrapped(PLACEHOLDER_1,  PLACEHOLDER_PROTOCOL2, PLACEHOLDER_2);

            let result = await lendingRegistry.getBestApr(PLACEHOLDER_1, [PLACEHOLDER_PROTOCOL, PLACEHOLDER_PROTOCOL2])
            expect(result.apr).to.eq(TWO_PERCENT.mul(2));
            expect(result.protocol).to.eq(PLACEHOLDER_PROTOCOL2);

            // test in call order reversed
            result = await lendingRegistry.getBestApr(PLACEHOLDER_1, [PLACEHOLDER_PROTOCOL2, PLACEHOLDER_PROTOCOL])
            expect(result.apr).to.eq(TWO_PERCENT.mul(2));
            expect(result.protocol).to.eq(PLACEHOLDER_PROTOCOL2);
        });
    })
});