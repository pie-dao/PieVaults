require("dotenv").config();

import { usePlugin, task, types } from  "@nomiclabs/buidler/config";

import {Signer, Wallet, utils, constants, Contract, BytesLike} from "ethers";
import {deployContract} from "ethereum-waffle";

import DiamondFactoryArtifact from './artifacts/DiamondFactoryContract.json';
import {DiamondFactoryContract} from "./typechain/DiamondFactoryContract";
import { BasketFacet, CallFacet, DiamondCutFacet, DiamondFactory, DiamondFactoryContractFactory, DiamondLoupeFacet, Erc20Facet, OwnershipFacet, PieFactoryContract, PieFactoryContractFactory } from "./typechain";

import BasketFacetArtifact from "./artifacts/BasketFacet.json";
import Erc20FacetArtifact from "./artifacts/ERC20Facet.json";
import CallFacetArtifact from "./artifacts/CallFacet.json";
import DiamondCutFacetArtifact from "./artifacts/DiamondCutFacet.json";
import DiamondLoupeFacetArtifact from "./artifacts/DiamondLoupeFacet.json";
import OwnershipFacetArtifact from "./artifacts/OwnershipFacet.json";
import PieFactoryContractArtifact from "./artifacts/PieFactoryContract.json";
import { IExperiPieFactory } from "./typechain/IExperiPieFactory";
import { Ierc20Factory } from "./typechain/Ierc20Factory";
import { LendingLogicCompoundFactory } from "./typechain/LendingLogicCompoundFactory";
import { LendingRegistry } from "./typechain/LendingRegistry";
import { LendingRegistryFactory } from "./typechain/LendingRegistryFactory";
import { LendingLogicAaveFactory } from "./typechain/LendingLogicAaveFactory";

usePlugin("@nomiclabs/buidler-ethers");
usePlugin('solidity-coverage');
usePlugin("@nomiclabs/buidler-etherscan");
usePlugin('solidity-coverage');

function getSelectors(contract: Contract) {
  const signatures: BytesLike[] = [];
  for(const key of Object.keys(contract.functions)) {
      signatures.push(utils.keccak256(utils.toUtf8Bytes(key)).substr(0, 10));
  }

  return signatures;
}

const config = {
  defaultNetwork: 'buidlerevm',
  networks: {
    buidlerevm: {
      gasPrice: 0,
      blockGasLimit: 10000000,
    },
    localhost: {
      url: 'http://localhost:8545'
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 70000000000
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY]
    },
    coverage: {
      url: 'http://127.0.0.1:8555', // Coverage launches its own ganache-cli client
      gasPrice: 0,
      blockGasLimit: 100000000,
    },
    frame: {
      url: "http://localhost:1248"
    }
  },
  solc: {
    version: '0.7.1',
    optimizer: {
      // Factory goes above contract size limit
      enabled: true,
      runs: 200
    }
  },
  etherscan: { apiKey: process.env.ETHERSCAN_KEY }
}

task("deploy-diamond-factory")
  .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();
    const diamondFactory = (await deployContract(signers[0] as Wallet, DiamondFactoryArtifact, [], {gasLimit: 5000000})) as DiamondFactoryContract;
    console.log("Factory address:", diamondFactory.address);
    return diamondFactory;
});

task("deploy-diamond-from-factory")
  .addParam("factory", "address of the factory")
  .addParam("diamondCut", "facets to add", undefined, types.json)
  .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();
    const account = await signers[0].getAddress();
    const diamondCut = taskArgs.diamondCut;
    console.log(diamondCut);
    const diamondFactory = DiamondFactoryContractFactory.connect(taskArgs.factory, signers[0]);

    diamondFactory.deployNewDiamond(account, diamondCut);
});

task("execute-calls")
  .addParam("pie", "address of the pie")
  .addParam("input", "calls.json", "./call.json")
  .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();
    const account = await signers[0].getAddress();

    const pie = IExperiPieFactory.connect(taskArgs.pie, signers[0]);

    const calls = require(taskArgs.input);

    const targets: string[] = calls.map((item) => item.target);
    const data: string[] = calls.map((item) => item.data);
    const values: string[] = calls.map((item) => item.value);

    const tx = await pie.call(
      targets,
      data,
      values
    );

    console.log("Calls send tx id:", tx.hash);
});

task("get-default-cut")
  .addParam("factory")
  .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();

    const factory = PieFactoryContractFactory.connect(taskArgs.factory, signers[0]);
    const cut = await factory.getDefaultCut();

    console.log(cut);
});

task("deploy-pie-from-factory")
  .addParam("allocation", "path to json")
  .addParam("factory", "pieFactory address", "0xf1e9eC6f1a4D00a24a9F8035C2C5e1D093f9b9aD")
  .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();
    const account = await signers[0].getAddress();

    const factory = PieFactoryContractFactory.connect(taskArgs.factory, signers[0]);


    const allocation = require(taskArgs.allocation);

    const tokens = allocation.tokens;

    for (const token of tokens) {
      const tokenContract = Ierc20Factory.connect(token.address, signers[0]);
      const allowance = await tokenContract.allowance(account, factory.address);

      if(allowance.lt(token.amount)) {
        console.log(`Approving ${token.name} ${token.address}`);
        await (await tokenContract.approve(factory.address, constants.MaxUint256)).wait(1);
      }
    }

    const receipt = await factory.bakePie(
      tokens.map(token => (token.address)),
      tokens.map(token => (token.amount)),
      allocation.initialSupply,
      allocation.symbol,
      allocation.name
    );

    console.log(`Pie deployed: ${receipt.hash}`);
});

task("deploy-pie-factory")
  .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();
    const account = await signers[0].getAddress();

    console.log("deploying from:", account);

    const contracts: any[] = [];

    const gasPrice = 40000000000

    const overrides = {
      gasPrice
    };

    const basketFacet = (await deployContract(signers[0], BasketFacetArtifact, [], overrides)) as BasketFacet;
    contracts.push({name: "basketFacet", address: basketFacet.address});
    const erc20Facet = (await deployContract(signers[0], Erc20FacetArtifact, [], overrides)) as Erc20Facet;
    contracts.push({name: "erc20Facet", address: erc20Facet.address});
    const callFacet = (await deployContract(signers[0], CallFacetArtifact, [], overrides)) as CallFacet;
    contracts.push({name: "callFacet", address: callFacet.address});
    const diamondCutFacet = (await deployContract(signers[0], DiamondCutFacetArtifact, [], overrides)) as DiamondCutFacet;
    contracts.push({name: "diamondCutFacet", address: diamondCutFacet.address});
    const diamondLoupeFacet = (await deployContract(signers[0], DiamondLoupeFacetArtifact, [], overrides)) as DiamondLoupeFacet;
    contracts.push({name: "diamondLoupeFacet", address: diamondLoupeFacet.address});
    const ownershipFacet = (await deployContract(signers[0], OwnershipFacetArtifact, [], overrides)) as OwnershipFacet;
    contracts.push({name: "ownershipFacet", address: ownershipFacet.address});

    console.table(contracts);

    const FacetCutAction = {
      Add: 0,
      Replace: 1,
      Remove: 2,
    };

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

    console.log(JSON.stringify(diamondCut));

    console.log("deploying factory");
    const pieFactory = (await deployContract(signers[0], PieFactoryContractArtifact, [] , overrides)) as PieFactoryContract;
    console.log(`Factory deployed at: ${pieFactory.address}`);

    // Add default facets
    for(const facet of diamondCut) {
      console.log("adding default facet");
      await (await pieFactory.addFacet(facet, overrides)).wait(1);
    }

});

task("deploy-lending-registry")
  .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();
    const lendingRegistry = await (new LendingRegistryFactory(signers[0])).deploy();
    console.log(`Deployed lendingRegistry at: ${lendingRegistry.address}`);
  });

task("deploy-lending-logic-compound")
  .addParam("lendingRegistry", "address of the lending registry")
  .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();
    
    const lendingLogicCompound = await (new LendingLogicCompoundFactory(signers[0])).deploy(taskArgs.lendingRegistry);

    console.log(`Deployed lendingLogicCompound at: ${lendingLogicCompound.address}`);
});

task("deploy-lending-logic-aave")
  .addParam("lendingPool")
  .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();

    const lendingLogicAave = await (new LendingLogicAaveFactory(signers[0])).deploy(taskArgs.lendingPool, 21);

    console.log(`Deployed lendingLogicAave at: ${lendingLogicAave.address}`);
});

export default config;