import { usePlugin, task, types } from  "@nomiclabs/buidler/config";

import {Signer, Wallet, utils, constants, Contract, BytesLike} from "ethers";
import {deployContract} from "ethereum-waffle";

import DiamondFactoryArtifact from './artifacts/DiamondFactoryContract.json';
import {DiamondFactoryContract} from "./typechain/DiamondFactoryContract";
import { BasketFacet, CallFacet, DiamondCutFacet, DiamondFactory, DiamondFactoryContractFactory, DiamondLoupeFacet, Erc20Facet, OwnershipFacet, PieFactoryContract } from "./typechain";

import BasketFacetArtifact from "./artifacts/BasketFacet.json";
import Erc20FacetArtifact from "./artifacts/ERC20Facet.json";
import CallFacetArtifact from "./artifacts/CallFacet.json";
import DiamondCutFacetArtifact from "./artifacts/DiamondCutFacet.json";
import DiamondLoupeFacetArtifact from "./artifacts/DiamondLoupeFacet.json";
import OwnerShipFacetArtifact from "./artifacts/OwnerShipFacet.json";
import PieFactoryContractArtifact from "./artifacts/PieFactoryContract.json";

usePlugin("@nomiclabs/buidler-ethers");
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
    coverage: {
      url: 'http://localhost:8555'
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

task("deploy-pie-factory")
  .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();
    const account = await signers[0].getAddress();

    const contracts: any[] = [];
    
    const basketFacet = (await deployContract(signers[0], BasketFacetArtifact)) as BasketFacet;
    contracts.push({name: "basketFacet", address: basketFacet.address});
    const erc20Facet = (await deployContract(signers[0], Erc20FacetArtifact)) as Erc20Facet;
    contracts.push({name: "erc20Facet", address: erc20Facet.address});
    const callFacet = (await deployContract(signers[0], CallFacetArtifact)) as CallFacet;
    contracts.push({name: "callFacet", address: callFacet.address});
    const diamondCutFacet = (await deployContract(signers[0], DiamondCutFacetArtifact)) as DiamondCutFacet;
    contracts.push({name: "diamondCutFacet", address: diamondCutFacet.address});
    const diamondLoupeFacet = (await deployContract(signers[0], DiamondLoupeFacetArtifact)) as DiamondLoupeFacet;
    contracts.push({name: "diamondLoupeFacet", address: diamondLoupeFacet.address});
    const ownershipFacet = (await deployContract(signers[0], OwnerShipFacetArtifact)) as OwnershipFacet;
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

    console.log("deploying factory");
    const pieFactory = (await deployContract(signers[0], PieFactoryContractArtifact)) as PieFactoryContract;
    console.log(`Factory deployed at: ${pieFactory.address}`);

    // Add default facets
    for(const facet of diamondCut) {
      console.log("adding default facet");
      await pieFactory.addFacet(facet);
    }
    
});

export default config;