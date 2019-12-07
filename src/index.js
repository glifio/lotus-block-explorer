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

const shapeBlock = (block) => {
  const { BlsMessages, SecpkMessages } = block.Messages;

  const messages = [
    ...BlsMessages.map(m => ({ ...m, type: 'BlsMessage' })),
    ...SecpkMessages.map(m => ({ ...m, type: 'SecpkMessage' })),
  ];

  const shapedBlock = {
    cid: block.cid,
    header: {
      miner: block.Miner,
      tickets: [block.Ticket],
      parents: block.Parents,
      parentWeight: block.ParentWeight,
      height: block.Height,
      messages,
      timestamp: block.Timestamp,
      blocksig: block.BlockSig.Data,
      messageReceipts: block.messageReceipts,
      stateRoot: block.stateRoot,
      proof: block.EPostProof.Proof
    },
    messages: messages,
    messageReceipts: block.messageReceipts,
  };
  return shapedBlock
}

class Lotus {
  constructor({ jsonrpcEndpoint } = {}) {
    this.cache = {};
    this.seenParents = new Set();
    this.jsonrpcEndpoint = jsonrpcEndpoint || 'http://127.0.0.1:1234/rpc/v0';
  }

  lotusJSON = async (method, ...params) => {
    const { data } = await axios.post(this.jsonrpcEndpoint, {
      jsonrpc: '2.0',
      method: `Filecoin.${method}`,
      params: [...params],
      id: 1,
    });
    return data.result;
  };

  cacheBlock = block => {
    if (this.cache[block.Height]) {
      this.cache[block.Height].push(shapeBlock(block));
    } else {
      this.cache[block.Height] = [shapeBlock(block)];
    }
  };

  getChain = () => {
    return this.cache
  }

  getBlockMessages = messageHash =>
    this.lotusJSON('ChainGetBlockMessages', messageHash);

  getChainHead = () => this.lotusJSON('ChainHead');

  getParentReceipts = (receiptHash) => this.lotusJSON('ChainGetParentReceipts', receiptHash)

  visitBlock = (block, fromHeight) => {
    if (block.Parents) {
      return Promise.all(
        block.Parents.map(async parent => {
          if (this.seenParents.has(parent['/'])) {
            return;
          }
          this.seenParents.add(parent['/']);
          const [parentBlock, messages, messageReceipts] = await Promise.all([
            await this.getBlock(parent),
            await this.getBlockMessages(parent),
            await this.getParentReceipts(block.ParentMessageReceipts),
          ]);
          parentBlock.Messages = messages;
          parentBlock.messageReceipts = messageReceipts;
          parentBlock.stateRoot = block.ParentStateRoot;
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
    // add the block's cid back onto the block metadata for ease of use
    block.cid = blockHash['/'];
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

module.exports = { Lotus, shapeBlock };
