const fs = require('fs')
const { Lotus } = require('../')

const lotus = new Lotus();
const explore = async () => {
  const { Height } = await lotus.getChainHead();
  await lotus.explore({ fromHeight: Height - 100 });
  fs.writeFile('./chain.json', JSON.stringify(lotus.getChain()), () => {});
};
explore();