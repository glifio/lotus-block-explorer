const assert = require('assert')

const {Lotus} = require('../')
const sampleFilecoinExplorerBlock = require('./sampleFilecoinExplorerBlock.json');

/*
  This lotus explorer is initially being used in the https://github.com/filecoin-project/filecoin-explorer

  We swapped lotus for go-filecoin for syncing chain information. For ease of development, we simply shape our lotus explorer output to match the output expected by the go-filecoin explorer.
*/

const getRandomBlockFromChain = (chain) => {
  const heights = Object.keys(chain)
  for (let i = 0; i < heights.length; i++) {
    if (i >= 5) {
      if (chain[heights[i]].length > 0) return chain[heights[i]][0];
    }
  }
}

describe('lotus block explorer', () => {
  describe('explore', () => {
    it('returns blocks to match the go-filecoin block explorer chain api blocks', async () => {
      const lotus = new Lotus()
      const {Height} = await lotus.getChainHead();
      // collect blocks from 20 tipsets behind HEAD
      await lotus.explore({fromHeight: Height - 20})
      const block = getRandomBlockFromChain(lotus.getChain());
      // check fields field
      assert.equal(typeof block.cid, typeof sampleFilecoinExplorerBlock.cid)
      assert.equal(typeof block.stateRoot, typeof sampleFilecoinExplorerBlock.stateRoot)
      assert.equal(typeof block.ticket, typeof sampleFilecoinExplorerBlock.ticket)

      // check header field
      assert.equal(typeof block.header, 'object')
      assert.deepEqual(
        Object.keys(block.header).sort(),
        Object.keys(sampleFilecoinExplorerBlock.header).sort()
      )
    })
  })
})
