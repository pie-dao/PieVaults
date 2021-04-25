import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants, BigNumber, utils, Contract, BytesLike, BigNumberish } from "ethers";

import BasketFacetArtifact from "../artifacts/BasketFacet.json";
import Erc20FacetArtifact from "../artifacts/ERC20Facet.json";
import CallFacetArtifact from "../artifacts/CallFacet.json";
import DiamondCutFacetArtifact from "../artifacts/DiamondCutFacet.json";
import DiamondLoupeFacetArtifact from "../artifacts/DiamondLoupeFacet.json";
import OwnershipFacetArtifact from "../artifacts/OwnershipFacet.json";
import BufferFacetArtifact from "../artifacts/BufferFacet.json"

import PieFactoryContractArtifact from "../artifacts/PieFactoryContract.json";
import MockSynthetixArtifact from "../artifacts/MockSynthetix.json";
import RSISynthetixManagerArtifact from "../artifacts/RSISynthetixManager.json";
import ManualPriceReferenceFeedArtifact from "../artifacts/ManualPriceReferenceFeed.json";
import DiamondArtifact from "../artifacts/Diamond.json";

import { 
    Erc20Facet,
    BasketFacet,
    CallFacet,
    MockToken,
    MockTokenFactory,
    MockSynthetix,
    DiamondCutFacet,
    DiamondLoupeFacet,
    OwnershipFacet,
    PieFactoryContract,
    RsiSynthetixManager,
    RsiSynthetixManagerFactory,
    ManualPriceReferenceFeed,
    Diamond,
    BufferFacet,
} from "../typechain";

import { IExperiPie } from "../typechain/IExperiPie";
import { IExperiPieFactory } from "../typechain/IExperiPieFactory";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther, formatBytes32String, formatEther } from "ethers/lib/utils";

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

describe("BufferFacet", function() {
    this.timeout(300000000);

    let pieFactory: PieFactoryContract;
    let pie: IExperiPie;
    let account: string;
    let signers: Signer[];
    let timeTraveler: TimeTraveler;
    let diamondCut: any[];
    let tokens: MockToken[] = [];
    const currencyKeys = [
        formatBytes32String("sUSD"),
        formatBytes32String("sBTC"),
        formatBytes32String("sETH"),
        formatBytes32String("sCRV"),
    ];
    let synthetix: MockSynthetix;

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(ethereum);

        const basketFacet = (await deployContract(signers[0], BasketFacetArtifact)) as BasketFacet;
        const erc20Facet = (await deployContract(signers[0], Erc20FacetArtifact)) as Erc20Facet;
        const callFacet = (await deployContract(signers[0], CallFacetArtifact)) as CallFacet;
        const diamondCutFacet = (await deployContract(signers[0], DiamondCutFacetArtifact)) as DiamondCutFacet;
        const diamondLoupeFacet = (await deployContract(signers[0], DiamondLoupeFacetArtifact)) as DiamondLoupeFacet;
        const ownershipFacet = (await deployContract(signers[0], OwnershipFacetArtifact)) as OwnershipFacet;
        const bufferFacet = (await deployContract(signers[0], BufferFacetArtifact)) as BufferFacet

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
            {
                action: FacetCutAction.Add,
                facetAddress: bufferFacet.address,
                functionSelectors: getSelectors(bufferFacet)
            }
        ];

        pieFactory = (await deployContract(signers[0], PieFactoryContractArtifact)) as PieFactoryContract;

        const diamondImplementation = await(deployContract(signers[0], DiamondArtifact)) as Diamond;
        diamondImplementation.initialize([], constants.AddressZero);
        pieFactory.setDiamondImplementation(diamondImplementation.address);

        // Add default facets
        for(const facet of diamondCut) {
            await pieFactory.addFacet(facet);
        }

        await pieFactory.setDefaultController(account);

        // Deploy synthetix
        synthetix = await deployContract(signers[0], MockSynthetixArtifact) as MockSynthetix;

        for (const tokenKey of currencyKeys) {
            await synthetix.getOrSetToken(tokenKey);
            const token = MockTokenFactory.connect(await synthetix.getToken(tokenKey), signers[0]);
            tokens.push(token);
            await synthetix.setPrice(tokenKey, parseEther("1"));
            await token.approve(pieFactory.address, constants.MaxUint256);
            await token.mint(parseEther("1000000000000"), account);
        }
        console.log("Pie factory:", pieFactory.address);
        console.log("tokens",  tokens.map((token) => token.address));
        // deploy pie
        await pieFactory.bakePie(
            tokens.map((token) => token.address),
            tokens.map((token) => parseEther("1")),
            parseEther("1"),
            "BT",
            "BT"
        );
        pie = await IExperiPieFactory.connect(await pieFactory.pies(0), signers[0]) as IExperiPie;
        console.log(pie.address);
        
        for (const token of tokens) {
            await pie.setBufferAmounts(token.address, 0, parseEther("1000"));
            await token.approve(pie.address, constants.MaxUint256);
        }

        await pie.setExchangeRates(synthetix.address);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    describe.only("Very coolio", async() => {
        it("everyting coolio", async() => {

            const vaultBalanceBefore = await pie.balanceOf(account);
            await pie.enterSingleAsset(tokens[0].address, parseEther("1"), 0);
            const vaultBalanceAfter = await pie.balanceOf(account);

            console.log("token balance before", formatEther(vaultBalanceBefore));
            console.log("token balance after", formatEther(vaultBalanceAfter));
        })
    })

   
});