import { usePlugin, task, types } from  "@nomiclabs/buidler/config";

import {Signer, Wallet, utils, constants} from "ethers";
import {deployContract} from "ethereum-waffle";

import DiamondFactoryArtifact from './artifacts/DiamondFactoryContract.json';
import {DiamondFactoryContract} from "./typechain/DiamondFactoryContract";
import { DiamondFactory, DiamondFactoryContractFactory } from "./typechain";

usePlugin("@nomiclabs/buidler-ethers");
usePlugin('solidity-coverage');


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

export default config;