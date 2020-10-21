import { usePlugin } from  "@nomiclabs/buidler/config";

usePlugin("@nomiclabs/buidler-ethers");
usePlugin('solidity-coverage')

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
      // PieFactory pushes contract size over limit. Consider reducing factory size
      enabled: true,
      runs: 200
    }
  },
}

export default config;