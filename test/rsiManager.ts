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

import PieFactoryContractArtifact from "../artifacts/PieFactoryContract.json";
import MockSynthetixArtifact from "../artifacts/MockSynthetix.json";
import RSISynthetixManagerArtifact from "../artifacts/RSISynthetixManager.json";
import ManualPriceReferenceFeedArtifact from "../artifacts/ManualPriceReferenceFeed.json";

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
} from "../typechain";

import { IExperiPie } from "../typechain/IExperiPie";
import { IExperiPieFactory } from "../typechain/IExperiPieFactory";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther, formatBytes32String } from "ethers/lib/utils";

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

describe("RSIManager", function() {
    this.timeout(300000000);

    let pieFactory: PieFactoryContract;
    let pie: IExperiPie;
    let account: string;
    let signers: Signer[];
    let timeTraveler: TimeTraveler;
    let diamondCut: any[];
    let shortToken: MockToken;
    const shortTokenKey = formatBytes32String("sUSD");
    let longToken: MockToken;
    const longTokenKey = formatBytes32String("sBTC");
    let synthetix: MockSynthetix;
    let rsiManager: RsiSynthetixManager;
    let priceFeed: ManualPriceReferenceFeed;

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

        // Deploy synthetix
        synthetix = await deployContract(signers[0], MockSynthetixArtifact) as MockSynthetix;

        // Deploy mock short token
        await synthetix.getOrSetToken(shortTokenKey);
        shortToken = MockTokenFactory.connect(await synthetix.getToken(shortTokenKey), signers[0]);

        // Deploy longToken
        await synthetix.getOrSetToken(longTokenKey);
        longToken = MockTokenFactory.connect(await synthetix.getToken(longTokenKey), signers[0]);
        
        // Set prices
        await synthetix.setPrice(shortTokenKey, parseEther("1"));
        await synthetix.setPrice(longTokenKey, parseEther("10000"));

        // approve sUSD
        await shortToken.approve(pieFactory.address, constants.MaxUint256);
        await shortToken.mint(parseEther("1000"), account);

        // deploy pie
        await pieFactory.bakePie([shortToken.address], [parseEther("1")], parseEther("1"), "RSI", "RSI");

        pie = await IExperiPieFactory.connect(await pieFactory.pies(0), signers[0]) as IExperiPie;

        // deploy manual price feed
        priceFeed = await deployContract(signers[0], ManualPriceReferenceFeedArtifact) as ManualPriceReferenceFeed;

        // deploy RSI manager
        rsiManager = await deployContract(signers[0], RSISynthetixManagerArtifact, [
            shortToken.address,
            longToken.address,
            shortTokenKey,
            longTokenKey,
            parseEther("30"),
            parseEther("70"),
            priceFeed.address,
            pie.address,
            synthetix.address
        ]) as RsiSynthetixManager;

        await pie.addCaller(rsiManager.address);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    describe("constructor", async() => {
        it("Deploying with an invalid assetShort should fail", async() => {
            const promise = deployContract(signers[0], RSISynthetixManagerArtifact, [
                constants.AddressZero,
                longToken.address,
                shortTokenKey,
                longTokenKey,
                parseEther("30"),
                parseEther("70"),
                priceFeed.address,
                pie.address,
                synthetix.address
            ]);

            await expect(promise).to.be.revertedWith("INVALID_ASSET_SHORT");
        });
        it("Deploying with an invalid assetLong should fail", async() => {
            const promise = deployContract(signers[0], RSISynthetixManagerArtifact, [
                shortToken.address,
                constants.AddressZero,
                shortTokenKey,
                longTokenKey,
                parseEther("30"),
                parseEther("70"),
                priceFeed.address,
                pie.address,
                synthetix.address
            ]);

            await expect(promise).to.be.revertedWith("INVALID_ASSET_LONG");
        });

        it("Deploying with an invalid assetShortKey should fail", async() => {
            const promise = deployContract(signers[0], RSISynthetixManagerArtifact, [
                shortToken.address,
                longToken.address,
                "0x0000000000000000000000000000000000000000000000000000000000000000",
                longTokenKey,
                parseEther("30"),
                parseEther("70"),
                priceFeed.address,
                pie.address,
                synthetix.address
            ]);

            await expect(promise).to.be.revertedWith("INVALID_ASSET_SHORT_KEY");
        });

        it("Deploying with an invalid assetLongKey should fail", async() => {
            const promise = deployContract(signers[0], RSISynthetixManagerArtifact, [
                shortToken.address,
                longToken.address,
                shortTokenKey,
                "0x0000000000000000000000000000000000000000000000000000000000000000",
                parseEther("30"),
                parseEther("70"),
                priceFeed.address,
                pie.address,
                synthetix.address
            ]);

            await expect(promise).to.be.revertedWith("INVALID_ASSET_LONG_KEY");
        });

        it("Deploying with a RSI bottom bigger than RSI top should fail", async() => {
            const promise = deployContract(signers[0], RSISynthetixManagerArtifact, [
                shortToken.address,
                longToken.address,
                shortTokenKey,
                longTokenKey,
                parseEther("30"),
                parseEther("29"),
                priceFeed.address,
                pie.address,
                synthetix.address
            ]);

            await expect(promise).to.be.revertedWith("RSI bottom should be bigger than RSI top");
        });

        it("Deploying with a RSI bottom below zero should fail", async() => {
            const promise = deployContract(signers[0], RSISynthetixManagerArtifact, [
                shortToken.address,
                longToken.address,
                shortTokenKey,
                longTokenKey,
                -1,
                parseEther("29"),
                priceFeed.address,
                pie.address,
                synthetix.address
            ]);

            await expect(promise).to.be.revertedWith("RSI bottom should be bigger than 0");
        });

        it("Deploying with a RSI top above 100 should should fail", async() => {
            const promise = deployContract(signers[0], RSISynthetixManagerArtifact, [
                shortToken.address,
                longToken.address,
                shortTokenKey,
                longTokenKey,
                parseEther("10"),
                parseEther("101"),
                priceFeed.address,
                pie.address,
                synthetix.address
            ]);

            await expect(promise).to.be.revertedWith("RSI top should be less than 100");
        });

        it("Deploying with an invalid pricefeed should fail", async() => {
            const promise = deployContract(signers[0], RSISynthetixManagerArtifact, [
                shortToken.address,
                longToken.address,
                shortTokenKey,
                longTokenKey,
                parseEther("30"),
                parseEther("70"),
                constants.AddressZero,
                pie.address,
                synthetix.address
            ]);

            await expect(promise).to.be.revertedWith("INVALID_PRICE_FEED");
        });

        it("Deploying with an invalid basket should fail", async() => {
            const promise = deployContract(signers[0], RSISynthetixManagerArtifact, [
                shortToken.address,
                longToken.address,
                shortTokenKey,
                longTokenKey,
                parseEther("30"),
                parseEther("70"),
                priceFeed.address,
                constants.AddressZero,
                synthetix.address
            ]);

            await expect(promise).to.be.revertedWith("INVALID_BASKET");
        });

        it("Deploying with an invalid synthetix address should fail", async() => {
            const promise = deployContract(signers[0], RSISynthetixManagerArtifact, [
                shortToken.address,
                longToken.address,
                shortTokenKey,
                longTokenKey,
                parseEther("30"),
                parseEther("70"),
                priceFeed.address,
                pie.address,
                constants.AddressZero
            ]);

            await expect(promise).to.be.revertedWith("INVALID_SYNTHETIX");
        });
    });

    describe("long", async() => {
        it("Switching from short to long", async() => {
            await priceFeed.update(parseEther("10"));

            const tokensBefore = await pie.getTokens();
            expect(tokensBefore.length).to.eq(1);
            expect(tokensBefore[0]).to.eq(shortToken.address);
            
            await rsiManager.rebalance();

            const tokensAfter = await pie.getTokens();
            expect(tokensAfter.length).to.eq(1);
            expect(tokensAfter[0]).to.eq(longToken.address);

            const shortTokenBalanceAfter = await shortToken.balanceOf(pie.address);
            const longTokenBalanceAfter = await longToken.balanceOf(pie.address);

            expect(shortTokenBalanceAfter).to.eq(0);
            expect(longTokenBalanceAfter).to.eq(parseEther("0.0001"));

            const locked = await pie.getLock();
            expect(locked).to.eq(true);
        });
        it("Non zero short balance afterwards should fail", async() => {
            await priceFeed.update(parseEther("10"));
            await synthetix.setSubtractSourceAmount(parseEther("0.001"));

            await expect(rsiManager.rebalance()).to.be.revertedWith("Current token balance should be zero");
        });
    });

    describe("short", async() => {
        beforeEach(async() => {
            // first long to later short
            await priceFeed.update(parseEther("10"));
            await rsiManager.rebalance();
        });
        it("Switching from short to long", async() => {
            await priceFeed.update(parseEther("90"));

            await rsiManager.rebalance();

            const tokensAfter = await pie.getTokens();
            expect(tokensAfter.length).to.eq(1);
            expect(tokensAfter[0]).to.eq(shortToken.address);

            const shortTokenBalanceAfter = await shortToken.balanceOf(pie.address);
            const longTokenBalanceAfter = await longToken.balanceOf(pie.address);

            expect(shortTokenBalanceAfter).to.eq(parseEther("1"));
            expect(longTokenBalanceAfter).to.eq(0);

            const locked = await pie.getLock();
            expect(locked).to.eq(true);
        });

        it("Non zero long balance afterwards should fail", async() => {
            await priceFeed.update(parseEther("90"));
            await synthetix.setSubtractSourceAmount(parseEther("0.000000001"));

            await expect(rsiManager.rebalance()).to.be.revertedWith("Current token balance should be zero");
        });
    });

    it("Should not rebalance with a RSI between 30 and 70 (non inclusive)", async() => {
        await priceFeed.update(parseEther("31"));

        await rsiManager.rebalance();

        const tokensAfter = await pie.getTokens();
        expect(tokensAfter.length).to.eq(1);
        expect(tokensAfter[0]).to.eq(shortToken.address);
        
        const shortTokenBalanceAfter = await shortToken.balanceOf(pie.address);
        const longTokenBalanceAfter = await longToken.balanceOf(pie.address);

        expect(shortTokenBalanceAfter).to.eq(parseEther("1"));
        expect(longTokenBalanceAfter).to.eq(0);
    });

    it("Rebalancing when price feed result is not final should fail", async() => {
        await expect(rsiManager.rebalance()).to.be.revertedWith("Round not complete");
    });
});