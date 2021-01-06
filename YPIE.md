Deploy lending registry and create mapping for YPIE

Based upon `0x17525e4f4af59fbc29551bc4ece6ab60ed49ce31`

With tokens in the pool
- aYFI
- AKRO
- PICKLE
- YFI
- COVER
- crKP3R
- crCREAM
- xSUSHI

```
npx builder --network localhost deploy-lending-registry


npx builder --network localhost deploy-lending-logic-compound --lending-registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 --protocol-key 0x40e45d329815e79a55e43916f11f7a0112a31146f63a4fcaea413df0567a0bb2

//cream protocol
//keepr
npx builder --network localhost set-lending-registry \
  --lending-registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  --lending-logic 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  --protocol-key 0x40e45d329815e79a55e43916f11f7a0112a31146f63a4fcaea413df0567a0bb2 \
  --wrapped 0x903560b1cce601794c584f58898da8a8b789fc5d \
  --underlying 0x1ceb5cb57c4d4e2b2433641b95dd330a33185a44

// cream
npx builder --network localhost set-lending-registry \
  --lending-registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  --lending-logic 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  --protocol-key 0x40e45d329815e79a55e43916f11f7a0112a31146f63a4fcaea413df0567a0bb2 \
  --wrapped 0x892b14321a4fcba80669ae30bd0cd99a7ecf6ac0 \
  --underlying 0x2ba592f78db6436527729929aaf6c908497cb200

npx builder --network localhost deploy-lending-logic-aave --lending-pool 0x398eC7346DcD622eDc5ae82352F02bE94C62d119

// aYfi
npx builder --network localhost set-lending-registry \
  --lending-registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  --lending-logic 0x610178dA211FEF7D417bC0e6FeD39F05609AD788 \
  --protocol-key 0xa9699be9874dcc3e11474d7d87b44bb314eb412a1960f1478100f7e2ccd4a6eb \
  --wrapped 0x12e51E77DAAA58aA0E9247db7510Ea4B46F9bEAd \
  --underlying 0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e

npx builder --network localhost deploy-stake-sushi \
  --lending-registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  --protocol-key 0xeafaa563273a4fdf984f5a9f1836dba7d5800658b802d449eb6ee18fce3d7c81

// xsushi
npx builder --network localhost set-lending-registry \
  --lending-registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  --lending-logic 0x0B306BF915C4d645ff596e518fAf3F9669b97016 \
  --protocol-key 0xeafaa563273a4fdf984f5a9f1836dba7d5800658b802d449eb6ee18fce3d7c81 \
  --wrapped 0x8798249c2e607446efb7ad49ec89dd1865ff4272 \
  --underlying 0x6b3595068778dd592e39a122f4f5a5cf09c90fe2

```

