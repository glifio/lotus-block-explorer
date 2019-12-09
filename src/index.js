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
    cid: block.cid['/'],
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
      stateRoot: block.ParentStateRoot,
      proof: block.EPostProof.Proof
    },
    messages: messages,
    messageReceipts: block.messageReceipts,
  };
  return shapedBlock
}

const actorTypes = {
  bafkqadlgnfwc6mjpmfrwg33vnz2a: 'Account',
  bafkqactgnfwc6mjpmnzg63q: 'Cron',
  bafkqac3gnfwc6mjpobxxozls: 'Storage Power',
  bafkqaddgnfwc6mjpnvqxe23foq: 'Storage Market',
  bafkqac3gnfwc6mjpnvuw4zls: 'Storage Miner',
  bafkqadtgnfwc6mjpnv2wy5djonuwo: 'Multisig',
  bafkqactgnfwc6mjpnfxgs5a: 'Init',
  bafkqac3gnfwc6mjpobqxsy3i: 'Payment Channel',
}

const shapeActorProps = (actor) => {
  return {
    address: actor.address,
    code: actor.Code,
    head: actor.Head,
    nonce: actor.Nonce,
    balance: actor.Balance,
    actorType: actorTypes[actor.Code['/']] || 'Unknown actor type'
  }
}

const shapeMessageReceipt = (messageReceipt) => {
  return {
    return: messageReceipt.Return,
    gasUsed: messageReceipt.GasUsed,
    exitCode: messageReceipt.ExitCode,
  }
}

class Lotus {
  constructor({ jsonrpcEndpoint, token } = {}) {
    this.cache = {};
    this.seenBlocks = new Set();
    this.seenHeights = new Set();
    this.blocksToView = [];
    this.jsonrpcEndpoint = jsonrpcEndpoint || 'http://127.0.0.1:1234/rpc/v0';
    this.token = token;
  }

  lotusJSON = async (method, ...params) => {
    const { data } = await axios.post(this.jsonrpcEndpoint, {
      jsonrpc: '2.0',
      method: `Filecoin.${method}`,
      params: [...params],
      id: 1,
    }, {
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    });
    return data.result;
  };

  cacheBlock = (block) => {
    if (this.cache[block.Height]) {
      this.cache[block.Height].push(shapeBlock(block));
    } else {
      this.cache[block.Height] = [shapeBlock(block)]
    }
  };

  getChain = () => {
    return this.cache
  }

  getBlockMessages = cid =>
    this.lotusJSON('ChainGetBlockMessages', cid);

  getTipSetByHeight = height => this.lotusJSON('ChainGetTipSetByHeight', height, null);

  getChainHead = () => this.lotusJSON('ChainHead');

  getParentReceipts = cid => this.lotusJSON('ChainGetParentReceipts', cid)

  listActors = () => this.lotusJSON('StateListActors', null)

  getActor = async (address) => {
    const actor = await this.lotusJSON('StateGetActor', address, null)
    return shapeActorProps({ ...actor, address })
  }

  getNextBlocksFromParents = (block) => {
    return Promise.all(
      block.Parents
        // make sure we dont visit any parents we've already seen
        .filter(parent => !this.seenBlocks.has(parent['/']))
        .map(async parent => {
          this.seenBlocks.add(parent['/']);
          const parentBlock = await this.getBlock(parent)
          parentBlock.cid = parent
          return parentBlock
        })
    )
  }

  // fetches the tipset, creates a placeholder , visits each block in the tipset
  getNextBlocksFromTipsetByHeight = async (height) => {
    // get the tipset from the height we havent seen yet
    const tipset = await this.getTipSetByHeight(height)
    // make sure we dont fetch by this height again
    this.seenHeights.add(height)
    return tipset.Blocks
      // make sure we dont visit blocks we've already seen
      .filter((_, i) => !this.seenBlocks.has(tipset.Cids[i]['/']))
      .map((block, i) => {
        // add the Cid prop to the block header for ease of use later on
        this.seenBlocks.add(tipset.Cids[i]['/']);
        return { ...block, cid: tipset.Cids[i] };
      })
    }

  getBlock = async blockHash => {
    const block = await this.lotusJSON('ChainGetBlock', blockHash);
    // add the block's cid back onto the block metadata for ease of use
    block.cid = blockHash['/'];
    return block;
  };

  addBlocksToViewList = async block => {
    if (block.Height > this.fromHeight) {
      // if we havent visited other blocks in this tipset, get the blocks directly from tipset
      if (!this.seenHeights.has(block.Height)) {
        this.blocksToView = this.blocksToView.concat(await this.getNextBlocksFromTipsetByHeight(block.Height))
      }

      // visit this block's parents
      if (block.Parents.length > 0) {
        this.blocksToView = this.blocksToView.concat(await this.getNextBlocksFromParents(block))
      }
    }
  }

  viewBlock = async (block) => {
    // shape and cache the blocks in the list
    const messages = await this.getBlockMessages(block.cid)
    const parentMessageReceipts = await this.getParentReceipts(block.cid)
    block.Messages = messages
    block.messageReceipts = parentMessageReceipts ? parentMessageReceipts.map(shapeMessageReceipt) : []
    // mark this block as seen
    this.cacheBlock(block)
  }

  recurse = async () => {
    while (this.blocksToView.length > 0) {
      // view blocks from right to left so we dont have to keep rebuilding the array
      const block = this.blocksToView.pop()
      await this.viewBlock(block)
      await this.addBlocksToViewList(block)
    }
  }

  explore = async (options = {}) => {
    this.toHeight = setToHeight(options.toHeight);
    this.fromHeight = setFromHeight(options.fromHeight)

    // follow web3.js pattern of allowing 'latest' for a param, which starts at the chain head
    if (this.toHeight === 'latest') {
      const { Height } = await this.getChainHead();
      // n - 1 is the first "valid" block, so explore from the latest height - 1
      return this.explore({ toHeight: Height - 1, fromHeight: setFromHeight.call(this, this.fromHeight) });
    }

    if (this.fromHeight > this.toHeight) throw new Error('fromHeight must be less than toHeight');

    // loop through all the tipsets sfrom from to so we dont miss any heights
    for (let i = this.toHeight; i >= this.fromHeight; i--) {
      this.blocksToView.push(
        ...(await this.getNextBlocksFromTipsetByHeight(i))
      );
    }
    await Promise.all(this.blocksToView)
    await this.recurse()
    return this.getChain()
  };
}

module.exports = { Lotus, shapeBlock };
