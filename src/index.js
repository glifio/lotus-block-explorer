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
    this.cache = {};
    this.seenParents = new Set();
  }

  lotusJSON = async (method, ...params) => {
    const { data } = await axios.post('http://127.0.0.1:1234/rpc/v0', {
      jsonrpc: '2.0',
      method: `Filecoin.${method}`,
      params: [...params],
      id: 1,
    });
    return data.result;
  };

  cacheBlock = block => {
    if (this.cache[block.Height]) {
      this.cache[block.Height].push(block);
    } else {
      this.cache[block.Height] = [block];
    }
  };

  getBlockMessages = messageHash =>
    this.lotusJSON('ChainGetBlockMessages', messageHash);

  getChainHead = () => this.lotusJSON('ChainHead');

  visitBlock = (block, fromHeight) => {
    if (block.Parents) {
      return Promise.all(
        block.Parents.map(async parent => {
          if (this.seenParents.has(parent['/'])) {
            return;
          }
          this.seenParents.add(parent['/']);
          const [parentBlock, messages] = await Promise.all([
            await this.getBlock(parent),
            await this.getBlockMessages(parent),
          ]);
          parentBlock.Messages = messages;
          this.cacheBlock(parentBlock);
          if (parentBlock.Height > fromHeight) {
            return this.visitBlock(parentBlock, fromHeight);
          }
        })
      );
    }
  };

  getBlock = async blockHash => {
    const block = await this.lotusJSON('ChainGetBlock', blockHash);
    block.Cid = blockHash;
    return block;
  };

  explore = async (options = {}) => {
    const from = setFromHeight(options.fromHeight);
    const to = setToHeight(options.toHeight);

    // follow web3.js pattern of allowing 'latest' for a param, which starts at the chain head
    if (to === 'latest') {
      const { Height } = await this.getChainHead();
      // n - 1 is the first "valid" block, so explore from the latest height - 1
      return this.explore({ toHeight: Height - 1, fromHeight: from });
    }

    if (from > to) throw new Error('fromHeight must be less than toHeight');

    const tipset = await this.getChainHead();
    await Promise.all(tipset.Blocks.map(block => this.visitBlock(block, from)));
  };
}

module.exports = { Lotus }
