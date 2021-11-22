import "@nomiclabs/buidler-ethers";
import 'solidity-coverage';

const config = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
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
    settings: {
      optimizer: {
        // PieFactory pushes contract size over limit. Consider reducing factory size
        enabled: true,
        runs:1000
      }
    }
  },
}

export default config;