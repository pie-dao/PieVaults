import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants, BigNumber, utils, Contract, BytesLike, BigNumberish } from "ethers";

import BasketFacetArtifact from "../artifacts/BasketFacet.json";
import Erc20FacetArtifact from "../artifacts/ERC20Facet.json";
import CallFacetArtifact from "../artifacts/CallFacet.json";
import DiamondCutFacetArtifact from "../artifacts/DiamondCutFacet.json";
import DiamondLoupeFacetArtifact from "../artifacts/DiamondLoupeFacet.json";
import OwnerShipFacetArtifact from "../artifacts/OwnerShipFacet.json";

import PieFactoryContractArtifact from "../artifacts/PieFactoryContract.json";
import TestTokenArtifact from "../artifacts/TestToken.json";
import { Erc20Facet, BasketFacet, CallFacet, DiamondFactoryContract, TestToken, DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet, PieFactoryContract } from "../typechain";
import {IExperiPie} from "../typechain/IExperiPie";
import TimeTraveler from "../utils/TimeTraveler";
import { parseEther } from "ethers/lib/utils";
import { IExperiPieFactory } from "../typechain/IExperiPieFactory";

chai.use(solidity);

const FacetCutAction = {
    Add: 0,
    Replace: 1,
    Remove: 2,
};

const PLACE_HOLDER_ADDRESS = "0x0000000000000000000000000000000000000001";


function getSelectors(contract: Contract) {
    const signatures: BytesLike[] = [];
    for(const key of Object.keys(contract.functions)) {
        signatures.push(utils.keccak256(utils.toUtf8Bytes(key)).substr(0, 10));
    }

    return signatures;
}

describe("PieFactoryContract", function() {
    this.timeout(300000);

    let pieFactory: PieFactoryContract;
    let account: string;
    let signers: Signer[];
    let timeTraveler: TimeTraveler;
    let diamondCut: any[];
    const testTokens: TestToken[] = [];

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(ethereum);
        
        const basketFacet = (await deployContract(signers[0], BasketFacetArtifact)) as BasketFacet;
        const erc20Facet = (await deployContract(signers[0], Erc20FacetArtifact)) as Erc20Facet;
        const callFacet = (await deployContract(signers[0], CallFacetArtifact)) as CallFacet;
        const diamondCutFacet = (await deployContract(signers[0], DiamondCutFacetArtifact)) as DiamondCutFacet;
        const diamondLoupeFacet = (await deployContract(signers[0], DiamondLoupeFacetArtifact)) as DiamondLoupeFacet;
        const ownershipFacet = (await deployContract(signers[0], OwnerShipFacetArtifact)) as OwnershipFacet;

        diamondCut = [
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

        pieFactory = (await deployContract(signers[0], PieFactoryContractArtifact)) as PieFactoryContract;

        // Add default facets
        for(const facet of diamondCut) {
            await pieFactory.addFacet(facet);
        }

        await pieFactory.setDefaultController(account);

        for(let i = 0; i < 3; i ++) {
          const token = await (deployContract(signers[0], TestTokenArtifact, ["Mock", "Mock"])) as TestToken;
          await token.mint(parseEther("1000000"), account);
          await token.approve(pieFactory.address, constants.MaxUint256);
          testTokens.push(token);
        }

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    describe("setDefaultController()", async() => {
        it("Setting the default controller should work", async() => {
            await pieFactory.setDefaultController(PLACE_HOLDER_ADDRESS);
            const controller = await pieFactory.defaultController();

            expect(controller).to.eq(PLACE_HOLDER_ADDRESS);
        });
        it("Setting the default controller from a non owner account should work", async() => {
            await expect(pieFactory.connect(signers[1]).setDefaultController(PLACE_HOLDER_ADDRESS)).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("removeFacet()", async() => {
        it("Removing a facet should work", async() => {
            const facetsBefore = await pieFactory.getDefaultCut();
            
            await pieFactory.removeFacet(0);

            const facetsAfter = await pieFactory.getDefaultCut();

            expect(facetsAfter.length).to.eq(facetsBefore.length - 1);

            expect(facetsAfter[0]).to.eql(facetsBefore[facetsBefore.length - 1]);
            expect(facetsAfter[1]).to.eql(facetsBefore[1]);
            expect(facetsAfter[2]).to.eql(facetsBefore[2]);
            expect(facetsAfter[3]).to.eql(facetsBefore[3]);
            expect(facetsAfter[4]).to.eql(facetsBefore[4]);
        });

        it("Removing a facet from a non owner account should fail", async() => {
            await expect(pieFactory.connect(signers[1]).removeFacet(0)).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("addFacet()", async() => {
        let startingFacets: any;
        beforeEach(async() => {
            startingFacets = await pieFactory.getDefaultCut();
            // Remove facet so we can add it again
            await pieFactory.removeFacet(diamondCut.length - 1);
        });
        it("Adding a facet should work", async() => {
            await pieFactory.addFacet(diamondCut[diamondCut.length - 1]);
            const facetsAfter = await pieFactory.getDefaultCut();

            expect(facetsAfter).to.eql(startingFacets);
        });
        it("Adding a facet from a non owner account should fail", async() => {
            await expect(pieFactory.connect(signers[1]).addFacet(diamondCut[diamondCut.length - 1])).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });


    describe("bakePie()", async() => {
        it("Baking a Pie should work", async() => {
            
            const initialSupply = parseEther("100");
            const symbol = "SYMBOL";
            const name = "NAME";
            const initialTokenAmount = parseEther("10");

            await pieFactory.bakePie(
                testTokens.map((token) => token.address),
                testTokens.map(() => initialTokenAmount),
                initialSupply,
                symbol,
                name
            );
            
            const pieAddress = await pieFactory.pies(0);
            const pie: IExperiPie = IExperiPieFactory.connect(pieAddress, signers[0]);
            
            // Metadata

            const pieInitialSupply = await pie.totalSupply();
            const pieSymbol = await pie.symbol();
            const pieName = await pie.name();
            const pieDecimals = await pie.decimals();

            expect(pieInitialSupply).to.eq(initialSupply);
            expect(pieSymbol).to.eq(symbol);
            expect(pieName).to.eq(name);
            expect(pieDecimals).to.eq(18);

            // Balances
            
            const userPieBalance = await pie.balanceOf(account);

            for(const token of testTokens) {
                const balance = await token.balanceOf(pie.address);
                expect(balance).to.eq(initialTokenAmount);
            }

            expect(userPieBalance).to.eq(initialSupply);

            // Control params

            const pieOwner = await pie.owner();
            const lockBlock = await pie.getLockBlock();
            const maxCap = await pie.getMaxCap();

            expect(pieOwner).to.eq(account);
            expect(lockBlock).to.eq(1);
            expect(maxCap).to.eq(constants.MaxUint256);
        });
    });

});