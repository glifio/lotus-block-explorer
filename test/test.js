const assert = require('assert')

const {shapeBlock} = require('../')
const sampleLotusBlock = require('./sampleLotusBlock.json')
const sampleFilecoinExplorerBlock = require('./sampleFilecoinExplorerBlock.json');

/*
  This lotus explorer is initially being used in the https://github.com/filecoin-project/filecoin-explorer

  We swapped lotus for go-filecoin for syncing chain information. For ease of development, we simply shape our lotus explorer output to match the output expected by the go-filecoin explorer.
*/

describe('lotus block explorer', () => {
  describe('shapeBlock', () => {
    it('returns an object that matches the go-filecoin block explorer chain api', () => {
      const block = shapeBlock(sampleLotusBlock)
      // check cid field
      assert(typeof block.cid, 'object')
      assert(typeof block.cid['/'], 'string')

      // check header field
      assert(typeof block.header, 'object')
      assert(
        Object.keys(block.header),
        Object.keys(sampleFilecoinExplorerBlock.header)
      );
    })
  })
})
