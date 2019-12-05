const axios = require('axios')

const seenParents = new Set()

const database = {

}

const lotusJSON = async (method, ...params) => {
  const {data} = await axios.post('http://127.0.0.1:1234/rpc/v0', {
    jsonrpc: '2.0',
    method: `Filecoin.${method}`,
    params: [...params],
    id: 1
  })
  return data.result
}

const getBlock = async (blockHash) => {
  const block = await lotusJSON('ChainGetBlock', blockHash)
  block.Cid = blockHash
  return block
}

const getBlockMessages = (messageHash) => lotusJSON('ChainGetBlockMessages', messageHash)

const getChainHead = () => lotusJSON('ChainHead')
/*
for now stubbing these because i can't get it to work yet
const getTipsetByHeight = (height) => lotusJSON('ChainGetTipSetByHeight', 500, {height: 200, cids: [], blks: []})
*/

const setToHeight = (height) => {
  if (!height) return 'latest'
  if (typeof height === 'string' && typeof Number(height) === 'number') return Number(height)
  if (typeof height === 'number') return height
  throw new Error('unhandled setToHeight case')
}

const setFromHeight = (height) => {
  if (!height) return 0
  if (typeof height === 'string' && typeof Number(height) === 'number') return Number(height)
  if (typeof height === 'number') return height
  throw new Error('unhandled setFromHeight case')
}

const addBlockToDatabase = (block) => {
  if (database[block.Height]) {
    database[block.Height].push(block)
  } else {
    database[block.Height] = [block]
  }
}

const visitBlock = (block) => {
  if (block.Parents) {
    return Promise.all(block.Parents.map(async parent => {
      if (seenParents.has(parent['/'])) {
        return
      }
      seenParents.add(parent['/'])
      const [parentBlock, messages] = await Promise.all([
        await getBlock(parent), await getBlockMessages(parent)
      ])
      parentBlock.Messages = messages
      addBlockToDatabase(parentBlock)
      return visitBlock(parentBlock)
    }))
  }
}

const explore = async (options = {}) => {
  const from = setFromHeight(options.fromHeight)
  const to = setToHeight(options.toHeight)

  // follow web3.js pattern of allowing 'latest' for a param, which starts at the chain head
  if (to === 'latest') {
    const {Height} = await getChainHead()
    // n - 1 is the first "valid" block, so explore from the latest height - 1
    return explore({toHeight: Height - 1, fromHeight: from})
  }

  if (from > to) throw new Error('fromHeight must be less than toHeight')

  const tipset = await getChainHead(from, {})
  await Promise.all(tipset.Blocks.map(block => visitBlock(block)))
}

explore({ fromHeight: 200 })
