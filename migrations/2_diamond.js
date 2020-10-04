const DiamondFactory = artifacts.require("DiamondFactory");
const DiamondCutFacet = artifacts.require("DiamondCutFacet");
const DiamondLoupeFacet = artifacts.require("DiamondLoupeFacet");
const OwnershipFacet = artifacts.require("OwnershipFacet");

const CallFacet = artifacts.require("CallFacet");
const BasketFacet = artifacts.require("BasketFacet");
const ERC20Facet = artifacts.require("ERC20Facet");
const ERC20Factory = artifacts.require("ERC20Factory");

const FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2,
};

function getSelectors(contract) {
  const selectors = contract.abi.reduce((acc, val) => {
    if (val.type === "function") {
      acc.push(val.signature);
      return acc;
    } else {
      return acc;
    }
  }, []);
  return selectors;
}

module.exports = async (deployer, network, accounts) => {
  deployer.deploy(ERC20Factory);
  await deployer.deploy(DiamondFactory);
  dm = await DiamondFactory.deployed();
  for (let i = 0; i < 15; i++) {
    await deployer.deploy(DiamondCutFacet);
    await deployer.deploy(DiamondLoupeFacet);
    await deployer.deploy(CallFacet);
    await deployer.deploy(ERC20Facet);
    await deployer.deploy(BasketFacet);
    await deployer.deploy(OwnershipFacet);
    const diamondCut = [
      [
        DiamondCutFacet.address,
        FacetCutAction.Add,
        getSelectors(DiamondCutFacet),
      ],
      [
        DiamondLoupeFacet.address,
        FacetCutAction.Add,
        getSelectors(DiamondLoupeFacet),
      ],
      [
        OwnershipFacet.address,
        FacetCutAction.Add,
        getSelectors(OwnershipFacet),
      ],
      [CallFacet.address, FacetCutAction.Add, getSelectors(CallFacet)],
      [ERC20Facet.address, FacetCutAction.Add, getSelectors(ERC20Facet)],
      [BasketFacet.address, FacetCutAction.Add, getSelectors(BasketFacet)],
    ];
    await dm.deployNewDiamond(accounts[0], diamondCut);
  }
};
