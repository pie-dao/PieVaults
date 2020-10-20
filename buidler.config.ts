import { usePlugin, task } from  "@nomiclabs/buidler/config";

import {Signer, Wallet, utils, constants} from "ethers";
import {deployContract} from "ethereum-waffle";

import DiamondFactoryArtifact from './artifacts/DiamondFactory.json';
import DiamondFactory from "./typechain/factories/DiamondFactory";

usePlugin("@nomiclabs/buidler-ethers");
usePlugin('solidity-coverage');


const config = {
  defaultNetwork: 'buidlerevm',
  networks: {
    buidlerevm: {
      gasPrice: 0,
      blockGasLimit: 100000000,
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
      enabled: false,
      runs: 200
    }
  },
}

task("deploy-diamond-factory")
  .setAction(async(taskArgs, {ethers}) => {
    const signers = await ethers.getSigners();

    const diamondFactory = (await deployContract(signers[0] as Wallet, DiamondFactoryArtifact, [])) as DiamondFactory;

});

export default config;