import chai, {expect} from "chai";
import { deployContract, solidity} from "ethereum-waffle";
import { ethers, run, ethereum, network } from "@nomiclabs/buidler";
import { Signer, constants, BigNumber, utils, Contract, BytesLike } from "ethers";

import BasketFacetArtifact from "../artifacts/BasketFacet.json";
import Erc20FacetArtifact from "../artifacts/ERC20Facet.json";
import CallFacetArtifact from "../artifacts/CallFacet.json";
import TestTokenArtifact from "../artifacts/TestToken.json";
import { Erc20Facet, BasketFacet, CallFacet, DiamondFactoryContract, TestToken } from "../typechain";
import {IExperiPieFactory} from "../typechain/IExperiPieFactory";
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

describe("CallFacet", function() {
    this.timeout(300000);

    let experiPie: IExperiPie;
    let account: string;
    let signers: Signer[];
    let timeTraveler: TimeTraveler;
    const testTokens: TestToken[] = [];

    before(async() => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
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

    describe("Call test", async () => {
        it("Test lock call", async () => {
            const latestBlock = await ethers.provider.getBlockNumber();
            
            const call = await experiPie.populateTransaction.setLock(latestBlock - 1);

            await experiPie.call(
              [call.to],
              [call.data],
              [0]
            );
    
            const lock = await experiPie.getLock();
            expect(lock).to.be.false;
        });
        it("Send contract ether", async () => {
            let ether = await ethers.provider.getBalance(experiPie.address);
            expect(ether).to.eq("0");
            
            await signers[0].sendTransaction({to: experiPie.address, value: parseEther("10")});
        
            ether = await ethers.provider.getBalance(experiPie.address);
            expect(ether).to.eq(parseEther("10"));

            const user = await signers[4].getAddress();
        
            const userBalanceBefore = await ethers.provider.getBalance(user);
        
            await experiPie.call([user], ["0x00"], [parseEther("9")]);
        
            ether = await ethers.provider.getBalance(experiPie.address);
            expect(ether).to.eq(parseEther("1"));
        
            
            const userBalanceAfter = await ethers.provider.getBalance(user);
        
            const difference = userBalanceAfter.sub(userBalanceBefore);
            expect(difference).to.eq(parseEther("9"));
        });
        it("Send contract erc20 token", async () => {
            let balance = await testTokens[0].balanceOf(experiPie.address);
            expect(balance).to.eq(0);
                
            await testTokens[0].transfer(experiPie.address, parseEther("1000"));
        
            balance = await testTokens[0].balanceOf(experiPie.address);
            expect(balance).to.eq(parseEther("1000"));
                
            const call = await testTokens[0].populateTransaction.transfer(account, parseEther("800"));

            await experiPie.call(
                [call.to],
                [call.data],
                [0]
            );
                
            balance = await testTokens[0].balanceOf(experiPie.address);
            expect(balance).to.eq(parseEther("200"));
        });
        it("Lock + send ether + send erc20", async () => {
            const latestBlock = await ethers.provider.getBlockNumber();

            await experiPie.setLock(latestBlock - 1);
            await signers[0].sendTransaction({to: experiPie.address, value: parseEther("1")});
        
            const token = testTokens[0];
        
            await token.transfer(experiPie.address, parseEther("200"));

            const balance = await token.balanceOf(experiPie.address);
            expect(balance).to.eq(parseEther("200"));

            const calls: any[] = [];

            const lockCall = await experiPie.populateTransaction.setLock(latestBlock + 100);
            lockCall.value = constants.Zero;
            const tokenCall = await token.populateTransaction.transfer(account, parseEther("200"));
            tokenCall.value = constants.Zero;
            const etherCall = {to: constants.AddressZero, value: parseEther("1"), data: "0x00"};
        
            await experiPie.call(
                [lockCall.to, tokenCall.to, etherCall.to],
                [lockCall.data, tokenCall.data, etherCall.data],
                [lockCall.value, tokenCall.value, etherCall.value],
            )
        
            const lock = await experiPie.getLock();
            expect(lock).to.be.true;
            const ether = await ethers.provider.getBalance(experiPie.address);
            expect(ether).to.eq(0);
            const balanceAfter = await token.balanceOf(experiPie.address);
            expect(balanceAfter).to.eq("0");
        });
      });
});