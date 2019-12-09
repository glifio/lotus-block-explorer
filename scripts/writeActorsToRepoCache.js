const fs = require('fs')
const { Lotus } = require('../');
const lotus = new Lotus();
const listActors = async () => {
  const actors = await lotus.listActors()
  const moreDetailedActors = await Promise.all(actors.map(actor => lotus.getActor(actor)))
  console.log(moreDetailedActors);
  fs.writeFile('./actors.json', JSON.stringify(moreDetailedActors), () => {});
}

listActors()