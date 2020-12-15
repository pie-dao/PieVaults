import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants, BigNumber, utils, Contract, BytesLike } from "ethers";

import BasketFacetArtifact from "../artifacts/BasketFacet.json";
import Erc20FacetArtifact from "../artifacts/ERC20Facet.json";
import CallFacetArtifact from "../artifacts/CallFacet.json";
import DiamondCutFacetArtifact from "../artifacts/DiamondCutFacet.json";
import DiamondLoupeFacetArtifact from "../artifacts/DiamondLoupeFacet.json";
import OwnershipFacetArtifact from "../artifacts/OwnershipFacet.json";

import LendingManagerArtifact from "../artifacts/LendingManager.json";
import DiamondArtifact from "../artifacts/Diamond.json";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther, formatBytes32String } from "ethers/lib/utils";
import { 
    MockAToken,
    MockCToken,
    MockToken,
    MockTokenFactory,
    MockATokenFactory,
    MockCTokenFactory,
    BasketFacet,
    Erc20Facet,
    CallFacet,
    DiamondCutFacet,
    DiamondLoupeFacet,
    OwnershipFacet,
    PieFactoryContract,
    LendingLogicAaveFactory,
    MockAaveLendingPool,
    MockAaveLendingPoolFactory,
    LendingLogicAave,
    LendingLogicCompound,
    LendingLogicCompoundFactory,
    LendingRegistry,
    LendingRegistryFactory,
    PieFactoryContractFactory,
    LendingManager,
    Diamond
} from "../typechain";
import { IExperiPieFactory } from "../typechain/IExperiPieFactory";
import { IExperiPie } from "../typechain/IExperiPie";

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

const COMPOUND = "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";
const AAVE = formatBytes32String("AAVE");

describe("LendingManager", function() {
    this.timeout(300000000);
    let account: string;
    let signers: Signer[];
    let timeTraveler: TimeTraveler;
    let aToken: MockAToken;
    let cToken: MockCToken;
    let token: MockToken;
    let pieFactory: PieFactoryContract;
    let pie: IExperiPie;

    let lendingLogicAave: LendingLogicAave;
    let lendingLogicCompound: LendingLogicCompound;
    let lendingRegistry: LendingRegistry;
    let lendingManager: LendingManager;

    const mintAmount = parseEther("1");

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(ethereum);

        // Deploy tokens
        token = await (new MockTokenFactory(signers[0])).deploy("Token", "TOKEN");
        aToken = await (new MockATokenFactory(signers[0]).deploy(token.address));
        cToken = await (new MockCTokenFactory(signers[0])).deploy(token.address);

        await token.mint(mintAmount, account);

        // ExperiPie
        const basketFacet = (await deployContract(signers[0], BasketFacetArtifact)) as BasketFacet;
        const erc20Facet = (await deployContract(signers[0], Erc20FacetArtifact)) as Erc20Facet;
        const callFacet = (await deployContract(signers[0], CallFacetArtifact)) as CallFacet;
        const diamondCutFacet = (await deployContract(signers[0], DiamondCutFacetArtifact)) as DiamondCutFacet;
        const diamondLoupeFacet = (await deployContract(signers[0], DiamondLoupeFacetArtifact)) as DiamondLoupeFacet;
        const ownershipFacet = (await deployContract(signers[0], OwnershipFacetArtifact)) as OwnershipFacet;

        pieFactory = await (new PieFactoryContractFactory(signers[0])).deploy();

        const diamondCut = [
            {
                action: FacetCutAction.Add,
                facetAddress: basketFacet.address,
                functionSelectors: getSelectors(basketFacet)
            },
            {
                action: FacetCutAction.Add,
                facetAddress: erc20Facet.address,
                functionSelectors: getSelectors(erc20Facet)
            },
            {
                action: FacetCutAction.Add,
                facetAddress: callFacet.address,
                functionSelectors: getSelectors(callFacet)
            },
            {
                action: FacetCutAction.Add,
                facetAddress: diamondCutFacet.address,
                functionSelectors: getSelectors(diamondCutFacet)
            },
            {
                action: FacetCutAction.Add,
                facetAddress: diamondLoupeFacet.address,
                functionSelectors: getSelectors(diamondLoupeFacet)
            },
            {
                action: FacetCutAction.Add,
                facetAddress: ownershipFacet.address,
                functionSelectors: getSelectors(ownershipFacet)
            },
        ];

        // Add default facets
        for(const facet of diamondCut) {
            await pieFactory.addFacet(facet);
        }

        await pieFactory.setDefaultController(account);
        
        const diamondImplementation = await(deployContract(signers[0], DiamondArtifact)) as Diamond;
        diamondImplementation.initialize([], constants.AddressZero);
        pieFactory.setDiamondImplementation(diamondImplementation.address);

        await token.approve(pieFactory.address, constants.MaxUint256);

        // deploy pie
        await pieFactory.bakePie([token.address], [mintAmount], parseEther("1"), "YIELD", "YIELD");
        pie = await IExperiPieFactory.connect(await pieFactory.pies(0), signers[0]) as IExperiPie;

        // deploy lending manager, logics and mocks
        const aaveLendingPool = await (new MockAaveLendingPoolFactory(signers[0])).deploy(token.address, aToken.address);

        lendingRegistry = await (new LendingRegistryFactory(signers[0])).deploy();

        lendingLogicAave = await (new LendingLogicAaveFactory(signers[0])).deploy(aaveLendingPool.address, 0);
        lendingLogicCompound = await (new LendingLogicCompoundFactory(signers[0])).deploy(lendingRegistry.address);

        // Setup lending registry
        await lendingRegistry.setUnderlyingToProtocolWrapped(token.address, AAVE, aToken.address);
        await lendingRegistry.setUnderlyingToProtocolWrapped(token.address, COMPOUND, cToken.address);
        await lendingRegistry.setProtocolToLogic(AAVE, lendingLogicAave.address);
        await lendingRegistry.setProtocolToLogic(COMPOUND, lendingLogicCompound.address);
        await lendingRegistry.setWrappedToUnderlying(aToken.address, token.address);
        await lendingRegistry.setWrappedToUnderlying(cToken.address, token.address);
        await lendingRegistry.setWrappedToProtocol(aToken.address, AAVE);
        await lendingRegistry.setWrappedToProtocol(cToken.address, COMPOUND);


        // Deploy and hookup lending manager
        lendingManager = await deployContract(signers[0], LendingManagerArtifact, [lendingRegistry.address, pie.address]) as LendingManager;
        await pie.addCaller(lendingManager.address);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    describe("Constructor", async() => {
        it("Should fail when lending registry is set to zero address", async() => {
            const promise = deployContract(signers[0], LendingManagerArtifact, [constants.AddressZero, pie.address]);
            await expect(promise).to.be.revertedWith("INVALID_LENDING_REGISTRY");
        });
        it("Should fail when basket is set to zero address", async() => {
            const promise = deployContract(signers[0], LendingManagerArtifact, [lendingRegistry.address, constants.AddressZero]);
            await expect(promise).to.be.revertedWith("INVALID_BASKET");
        });
    });

    describe("Lending", async() => {
        describe("Aave", async() => {
            it("Lending less than max should work", async() => {
                const lendAmount = mintAmount.div(2);
    
                await lendingManager.lend(token.address, lendAmount, AAVE);
    
                const tokens = await pie.getTokens();
    
                expect(tokens.length).to.eq(2);
                expect(tokens[0]).to.eq(token.address);
                expect(tokens[1]).to.eq(aToken.address);
    
                const tokenBalance = await token.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);
               
                expect(tokenBalance).to.eq(lendAmount);
                expect(aTokenBalance).to.eq(lendAmount);
            });
            it("Lending the max should work", async() => {
                await lendingManager.lend(token.address, mintAmount, AAVE);
    
                const tokens = await pie.getTokens();
    
                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(aToken.address);
    
                const tokenBalance = await token.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);
               
                expect(tokenBalance).to.eq(0);
                expect(aTokenBalance).to.eq(mintAmount);
            });
            it("Lending more than the max should lend the max", async() => {
                await lendingManager.lend(token.address, mintAmount.add(parseEther("2")), AAVE);
    
                const tokens = await pie.getTokens();
    
                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(aToken.address);
    
                const tokenBalance = await token.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);
               
                expect(tokenBalance).to.eq(0);
                expect(aTokenBalance).to.eq(mintAmount);
            });
        });
        describe("Compound", async() => {
            it("Lending less than the max should work", async() => {
                const lendAmount = mintAmount.div(2);
                await lendingManager.lend(token.address, lendAmount, COMPOUND);
    
                const tokens = await pie.getTokens();
    
                expect(tokens.length).to.eq(2);
                expect(tokens[0]).to.eq(token.address);
                expect(tokens[1]).to.eq(cToken.address);
    
                const tokenBalance = await token.balanceOf(pie.address);
                const cTokenBalance = await cToken.balanceOf(pie.address);
               
                expect(tokenBalance).to.eq(lendAmount);
                expect(cTokenBalance).to.eq(lendAmount.mul(5));
            });
            it("Lending the max should work", async() => {
                await lendingManager.lend(token.address, mintAmount, COMPOUND);
    
                const tokens = await pie.getTokens();
    
                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(cToken.address);
    
                const tokenBalance = await token.balanceOf(pie.address);
                const cTokenBalance = await cToken.balanceOf(pie.address);
               
                expect(tokenBalance).to.eq(0);
                expect(cTokenBalance).to.eq(mintAmount.mul(5));
            });
            it("Lending more than the max should lend the max", async() => {
                await lendingManager.lend(token.address, mintAmount.add(parseEther("2")), COMPOUND);
    
                const tokens = await pie.getTokens();
    
                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(cToken.address);
    
                const tokenBalance = await token.balanceOf(pie.address);
                const cTokenBalance = await cToken.balanceOf(pie.address);
               
                expect(tokenBalance).to.eq(0);
                expect(cTokenBalance).to.eq(mintAmount.mul(5));
            });
        });
    });

    describe("Unlending", async() => {
        describe("Aave", async() => {
            beforeEach(async() => {
                await lendingManager.lend(token.address, mintAmount, AAVE);
            });

            it("Unlending less than the max should work", async() => {
                const unlendAmount = mintAmount.div(2);
                await lendingManager.unlend(aToken.address, unlendAmount);
                
                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(2);
                expect(tokens[0]).to.eq(aToken.address);
                expect(tokens[1]).to.eq(token.address);

                const tokenBalance = await token.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);

                expect(tokenBalance).to.eq(unlendAmount);
                expect(aTokenBalance).to.eq(unlendAmount);
            });

            it("Unlending the max should work", async() => {
                await lendingManager.unlend(aToken.address, mintAmount);

                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(token.address);

                const tokenBalance = await token.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);

                expect(tokenBalance).to.eq(mintAmount);
                expect(aTokenBalance).to.eq(0);
            });

            it("Unlending more than the max should unlend the max", async() => {
                await lendingManager.unlend(aToken.address, mintAmount.add(100));

                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(token.address);

                const tokenBalance = await token.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);

                expect(tokenBalance).to.eq(mintAmount);
                expect(aTokenBalance).to.eq(0);
            });
        });

        describe("Compound", async() => {
            beforeEach(async() => {
                await lendingManager.lend(token.address, mintAmount, COMPOUND);
            });

            it("Unlending less than the max should work", async() => {
                const unlendAmount = mintAmount.div(2).mul(5);
                await lendingManager.unlend(cToken.address, unlendAmount);
                
                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(2);
                expect(tokens[0]).to.eq(cToken.address);
                expect(tokens[1]).to.eq(token.address);

                const tokenBalance = await token.balanceOf(pie.address);
                const cTokenBalance = await cToken.balanceOf(pie.address);

                expect(tokenBalance).to.eq(mintAmount.div(2));
                expect(cTokenBalance).to.eq(unlendAmount);
            });

            it("Unlending the max should work", async() => {
                const unlendAmount = mintAmount.mul(5);

                await lendingManager.unlend(cToken.address, unlendAmount);

                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(token.address);

                const tokenBalance = await token.balanceOf(pie.address);
                const cTokenBalance = await cToken.balanceOf(pie.address);

                expect(tokenBalance).to.eq(mintAmount);
                expect(cTokenBalance).to.eq(0);
            });

            it("Unlending more than the max should unlend the max", async() => {
                await lendingManager.unlend(cToken.address, constants.MaxUint256);

                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(token.address);

                const tokenBalance = await token.balanceOf(pie.address);
                const cTokenBalance = await cToken.balanceOf(pie.address);

                expect(tokenBalance).to.eq(mintAmount);
                expect(cTokenBalance).to.eq(0);
            });
        });
    });

    describe("Bouncing", async() => {
        describe("Compound to Aave", async() => {
            const cTokenAmount = mintAmount.mul(5);

            beforeEach(async() => {
                await lendingManager.lend(token.address, mintAmount, COMPOUND);
            });

            it("Bouncing less than max should work", async() => {
                const bounceAmount = cTokenAmount.div(2);
                await lendingManager.bounce(cToken.address, bounceAmount, AAVE);

                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(2);
                expect(tokens[0]).to.eq(cToken.address);
                expect(tokens[1]).to.eq(aToken.address);

                const cTokenBalance = await cToken.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);
                
                expect(cTokenBalance).to.eq(bounceAmount);
                expect(aTokenBalance).to.eq(mintAmount.div(2));
            });
            it("Bouncing the max should work", async() => {
                const bounceAmount = cTokenAmount;
                await lendingManager.bounce(cToken.address, bounceAmount, AAVE);

                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(aToken.address);

                const cTokenBalance = await cToken.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);
                
                expect(cTokenBalance).to.eq(0);
                expect(aTokenBalance).to.eq(mintAmount);
            });
            it("Bouncing more than the max should bounce the max", async() => {
                const bounceAmount = constants.MaxUint256;
                await lendingManager.bounce(cToken.address, bounceAmount, AAVE);

                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(aToken.address);

                const cTokenBalance = await cToken.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);
                
                expect(cTokenBalance).to.eq(0);
                expect(aTokenBalance).to.eq(mintAmount);
            });
        });
        describe("Aave to Compound", async() => {
            beforeEach(async() => {
                await lendingManager.lend(token.address, mintAmount, AAVE);
            });

            it("Bouncing less than max should work", async() => {
                const bounceAmount = mintAmount.div(2);
                const cTokenAmount = bounceAmount.mul(5);

                await lendingManager.bounce(aToken.address, bounceAmount, COMPOUND);

                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(2);
                expect(tokens[0]).to.eq(aToken.address);
                expect(tokens[1]).to.eq(cToken.address);

                const cTokenBalance = await cToken.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);
                
                expect(cTokenBalance).to.eq(cTokenAmount);
                expect(aTokenBalance).to.eq(bounceAmount);
            });
            it("Bouncing the max should work", async() => {
                const bounceAmount = mintAmount;
                const cTokenAmount = mintAmount.mul(5);
                await lendingManager.bounce(aToken.address, bounceAmount, COMPOUND);

                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(cToken.address);

                const cTokenBalance = await cToken.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);
                
                expect(cTokenBalance).to.eq(cTokenAmount);
                expect(aTokenBalance).to.eq(0);
            });
            it("Bouncing more than the max should bounce the max", async() => {
                const bounceAmount = constants.MaxUint256;
                const cTokenAmount = mintAmount.mul(5);
                await lendingManager.bounce(aToken.address, bounceAmount, COMPOUND);

                const tokens = await pie.getTokens();

                expect(tokens.length).to.eq(1);
                expect(tokens[0]).to.eq(cToken.address);

                const cTokenBalance = await cToken.balanceOf(pie.address);
                const aTokenBalance = await aToken.balanceOf(pie.address);
                
                expect(cTokenBalance).to.eq(cTokenAmount);
                expect(aTokenBalance).to.eq(0);
            });
        });
    });

    // TODO lending twice to a protocol
    // TODO access tests
});