import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants, BigNumber, utils, Contract, BytesLike } from "ethers";

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

describe.only("PieFactoryContract", function() {
    this.timeout(300000);

    let pieFactory: PieFactoryContract;
    let account: string;
    let signers: Signer[];
    let timeTraveler: TimeTraveler;
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

        pieFactory = (await deployContract(signers[0], PieFactoryContractArtifact)) as PieFactoryContract;

        // Add default facets
        for(const facet of diamondCut) {
            await pieFactory.addFacet(facet);
        }

        for(let i = 0; i < 3; i ++) {
          const token = await (deployContract(signers[0], TestTokenArtifact, ["Mock", "Mock"])) as TestToken;
          await token.mint(parseEther("1000000"), account);
          testTokens.push(token);
        }

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    // it("kek", async() => {
    //     console.log("kek");
    // });

    // TODO setController

    // TODO removeFacet

    // TODO addFacet

    // TODO bakePie

});