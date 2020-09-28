const Diamond = artifacts.require('Diamond')
const DiamondCutFacet = artifacts.require('DiamondCutFacet')
const DiamondLoupeFacet = artifacts.require('DiamondLoupeFacet')
const OwnershipFacet = artifacts.require('OwnershipFacet')

const CallFacet = artifacts.require('CallFacet')
const BasketFacet = artifacts.require('BasketFacet')
const ERC20Facet = artifacts.require('ERC20Facet')
const ERC20Factory = artifacts.require('ERC20Factory')

const FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2
}

function getSelectors (contract) {
  const selectors = contract.abi.reduce((acc, val) => {
    if (val.type === 'function') {
      acc.push(val.signature)
      return acc
    } else {
      return acc
    }
  }, [])
  return selectors
}

module.exports = function (deployer, network, accounts) {
  deployer.deploy(ERC20Factory)

  deployer.deploy(DiamondCutFacet)
  deployer.deploy(DiamondLoupeFacet)
  deployer.deploy(CallFacet)
  deployer.deploy(ERC20Facet)
  deployer.deploy(BasketFacet)
  deployer.deploy(OwnershipFacet).then(() => {
    const diamondCut = [
      [DiamondCutFacet.address, FacetCutAction.Add, getSelectors(DiamondCutFacet)],
      [DiamondLoupeFacet.address, FacetCutAction.Add, getSelectors(DiamondLoupeFacet)],
      [OwnershipFacet.address, FacetCutAction.Add, getSelectors(OwnershipFacet)],
      [CallFacet.address, FacetCutAction.Add, getSelectors(CallFacet)],
      [ERC20Facet.address, FacetCutAction.Add, getSelectors(ERC20Facet)],
      [BasketFacet.address, FacetCutAction.Add, getSelectors(BasketFacet)]
    ]
    return deployer.deploy(Diamond, accounts[0], diamondCut)
  })
}
