const shell = require('shelljs'); // This module is already a solidity-coverage dep

module.exports = {
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true               // Run the grep's inverse set.
  },
  providerOptions: {
      gasLimit: 1000000000,
      allowUnlimitedContractSize: true
  },
  onCompileComplete: async function(config){
    await run('typechain');
  },
  onIstanbulComplete: async function(config){
    shell.rm('-rf', './typechain'); // Clean up at the end
  }
}