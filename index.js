const axios = require('axios')

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

class Lotus {
  constructor() {
    this.database = {}
    this.seenParents = new Set()
  }

  lotusJSON = async (method, ...params) => {
    const { data } = await axios.post('http://127.0.0.1:1234/rpc/v0', {
      jsonrpc: '2.0',
      method: `Filecoin.${method}`,
      params: [...params],
      id: 1
    })
    return data.result
  }

  addBlockToDatabase = (block) => {
    if (this.database[block.Height]) {
      this.database[block.Height].push(block)
    } else {
      this.database[block.Height] = [block]
    }
  }

  getBlock = async (blockHash) => {
    const block = await this.lotusJSON('ChainGetBlock', blockHash)
    block.Cid = blockHash
    return block
  }

  getBlockMessages = (messageHash) => this.lotusJSON('ChainGetBlockMessages', messageHash)
  getChainHead = () => this.lotusJSON('ChainHead')

  visitBlock = (block) => {
    if (block.Parents) {
      return Promise.all(block.Parents.map(async parent => {
        if (this.seenParents.has(parent['/'])) {
          return
        }
        this.seenParents.add(parent['/'])
        const [parentBlock, messages] = await Promise.all([
          await this.getBlock(parent), await this.getBlockMessages(parent)
        ])
        parentBlock.Messages = messages
        this.addBlockToDatabase(parentBlock)
        return this.visitBlock(parentBlock)
      }))
    }
  }

  explore = async (options = {}) => {
    const from = setFromHeight(options.fromHeight)
    const to = setToHeight(options.toHeight)

    // follow web3.js pattern of allowing 'latest' for a param, which starts at the chain head
    if (to === 'latest') {
      const { Height } = await this.getChainHead()
      // n - 1 is the first "valid" block, so explore from the latest height - 1
      return this.explore({ toHeight: Height - 1, fromHeight: from })
    }

    if (from > to) throw new Error('fromHeight must be less than toHeight')

    const tipset = await this.getChainHead(from, {})
    await Promise.all(tipset.Blocks.map(block => this.visitBlock(block)))
  }
}

const lotus = new Lotus()

const doIt = async () => {
  await lotus.explore()
  console.log(lotus.database)
}

doIt()
/*
for now stubbing these because i can't get it to work yet
const getTipsetByHeight = (height) => lotusJSON('ChainGetTipSetByHeight', 500, {height: 200, cids: [], blks: []})
*/


// explore({ fromHeight: 200 })
