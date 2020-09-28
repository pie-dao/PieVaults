const Diamond = artifacts.require('Diamond')
const Test1Facet = artifacts.require('Test1Facet')
const Test2Facet = artifacts.require('Test2Facet')
const CallFacet = artifacts.require('CallFacet')
const BasketFacet = artifacts.require('BasketFacet')
const ERC20Facet = artifacts.require('ERC20Facet')
const ERC20Factory = artifacts.require('ERC20Factory')

module.exports = function (deployer, network, accounts) {
  // deployment steps
  // The constructor inside Diamond deploys DiamondFacet
  //throw Error(accounts[0])
  deployer.then(async () => {
    await deployer.deploy(Diamond, accounts[0])
    await deployer.deploy(Test1Facet)
    await deployer.deploy(Test2Facet)
    await deployer.deploy(CallFacet)
    await deployer.deploy(ERC20Facet)
    await deployer.deploy(BasketFacet)
    await deployer.deploy(ERC20Factory)
  })
}
