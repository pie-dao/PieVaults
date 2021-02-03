import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants, Contract, BytesLike, utils } from "ethers";
import TimeTraveler from "../utils/TimeTraveler";
import { IExperiPie } from "../typechain/IExperiPie";
import { MockToken } from "../typechain/MockToken";
import { BasketFacet, CallFacet, DiamondFactoryContract, Erc20Facet, TokenListUpdater } from "../typechain";
import BasketFacetArtifact from "../artifacts/BasketFacet.json";
import Erc20FacetArtifact from "../artifacts/ERC20Facet.json";
import TokenListUpdaterArtifact from "../artifacts/TokenListUpdater.json";
import CallFacetArtifact from "../artifacts/CallFacet.json";
import { IExperiPieFactory } from "../typechain/IExperiPieFactory";
import MockTokenArtifact from "../artifacts/MockToken.json";
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

describe("TokenListUpdater", function() {
    this.timeout(300000000);

    let experiPie: IExperiPie;

    let account: string;
    let account2: string;
    let signers: Signer[];
    let timeTraveler: TimeTraveler;
    let tokenListUpdater: TokenListUpdater;
    const testTokens: MockToken[] = [];
    const testTokenAddresses: string[] = [];
    let extraToken: MockToken;

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        account2 = await signers[1].getAddress();
        timeTraveler = new TimeTraveler(ethereum);

        const diamondFactory = (await run("deploy-diamond-factory")) as DiamondFactoryContract;

        const basketFacet = (await deployContract(signers[0], BasketFacetArtifact)) as BasketFacet;
        const erc20Facet = (await deployContract(signers[0], Erc20FacetArtifact)) as Erc20Facet;
        const callFacet = (await deployContract(signers[0], CallFacetArtifact)) as CallFacet;
        

        await diamondFactory.deployNewDiamond(
            account,
            [
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
                }
            ]
        )


        const experiPieAddress = await diamondFactory.diamonds(0);
        experiPie = IExperiPieFactory.connect(experiPieAddress, signers[0]);

        tokenListUpdater = (await deployContract(signers[0], TokenListUpdaterArtifact)) as TokenListUpdater

        for(let i = 0; i < 3; i ++) {
          const token = await (deployContract(signers[0], MockTokenArtifact, ["Mock", "Mock"])) as MockToken;
          await token.mint(parseEther("1000000"), experiPie.address);
          await experiPie.addToken(token.address);
          testTokens.push(token);
          testTokenAddresses.push(token.address);
        }

        extraToken = await (deployContract(signers[0], MockTokenArtifact, ["Mock", "Mock"])) as MockToken;
        await extraToken.mint(parseEther("1000000"), account);

        await experiPie.addCaller(tokenListUpdater.address);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    it("Calling from non owner should fail", async() => {
        await tokenListUpdater.renounceOwnership();
        await expect(tokenListUpdater.update(experiPie.address, testTokenAddresses)).to.be.revertedWith("Not allowed");
    });


    it("Removing a token when the balance is too low should work", async() => {
        const token = testTokens[testTokens.length - 1]
        const transferAmount = (await token.balanceOf(experiPie.address)).sub(1);

        // Send out tokens
        const tx = await token.populateTransaction.transfer(account2, transferAmount);
        await experiPie.singleCall(tx.to, tx.data, 0);

        await tokenListUpdater.update(experiPie.address, [token.address]);

        const tokens = await experiPie.getTokens();
        const tokenCount = tokens.length;

        expect(tokenCount).to.eq(testTokens.length - 1);
        expect(tokens).to.eql(testTokenAddresses.slice(0, -1));
    });

    it("Adding a token when it was not added before but the balance is sufficient should work", async() => {
        await extraToken.transfer(experiPie.address, parseEther("1"));

        await tokenListUpdater.update(experiPie.address, [extraToken.address]);

        const tokens = await experiPie.getTokens();
        const tokenCount = tokens.length;

        expect(tokenCount).to.eq(testTokens.length + 1);
        expect(tokens).to.eql([...testTokenAddresses, extraToken.address]);
    });

    it("Updating a token which is not in the list w/o sufficient balance", async() => {
        await extraToken.transfer(experiPie.address, "420");
        
        await tokenListUpdater.update(experiPie.address, [extraToken.address]);

        const tokens = await experiPie.getTokens();
        const tokenCount = tokens.length;

        expect(tokenCount).to.eq(testTokens.length);
        expect(tokens).to.eql(testTokenAddresses);
    });

    it("Updating a token which is in the list with sufficient balance should do nothing", async() => {
        await tokenListUpdater.update(experiPie.address, [testTokenAddresses[0]]);

        const tokens = await experiPie.getTokens();
        const tokenCount = tokens.length;

        expect(tokenCount).to.eq(testTokens.length);
        expect(tokens).to.eql(testTokenAddresses);
    });

    it("Updating from the pie itself should work", async() => {
        await tokenListUpdater.populateTransaction.update(experiPie.address, [testTokenAddresses[0]]);

        const tokens = await experiPie.getTokens();
        const tokenCount = tokens.length;

        expect(tokenCount).to.eq(testTokens.length);
        expect(tokens).to.eql(testTokenAddresses);
    });
});