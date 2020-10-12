const Uni = artifacts.require("Uni");
const CallFacet = artifacts.require("CallFacet");


module.exports = async (deployer, network, accounts) => {
    uniAddress = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
    diamondAddress = "0x318d27825678733f381bc7e17ebe82872bad6ff6";

    let uni = await Uni.at(uniAddress);
    uni = new web3.eth.Contract(Uni.abi, uniAddress);
    let diamond = await CallFacet.at(diamondAddress);
    //diamond = new web3.eth.Contract(CallFacet.abi, diamondAddress);

    await diamond.call(
          [uniAddress],
          [uni.methods.delegate("0x4efd8cead66bb0fa64c8d53ebe65f31663199c6d").encodeABI()],
          [0]
        );

}