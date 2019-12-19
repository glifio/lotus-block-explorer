const axios = require('axios');
const ObservableStore = require('obs-store');

const setToHeight = height => {
  if (!height) return 'latest';
  if (typeof height === 'string' && typeof Number(height) === 'number')
    return Number(height);
  if (typeof height === 'number') return height;
  throw new Error('unhandled setToHeight case');
};

const setFromHeight = height => {
  if (!height) return 0;
  if (typeof height === 'string' && typeof Number(height) === 'number')
    return Number(height);
  if (typeof height === 'number') return height;
  throw new Error('unhandled setFromHeight case');
};

const shapeBlock = block => {
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
      stateRoot: block.ParentStateRoot,
      proof: block.EPostProof.Proof,
    },
    messages: messages,
    messageReceipts: block.messageReceipts,
  };
  return shapedBlock;
};

const actorTypes = {
  bafkqadlgnfwc6mjpmfrwg33vnz2a: 'Account',
  bafkqactgnfwc6mjpmnzg63q: 'Cron',
  bafkqac3gnfwc6mjpobxxozls: 'Storage Power',
  bafkqaddgnfwc6mjpnvqxe23foq: 'Storage Market',
  bafkqac3gnfwc6mjpnvuw4zls: 'Storage Miner',
  bafkqadtgnfwc6mjpnv2wy5djonuwo: 'Multisig',
  bafkqactgnfwc6mjpnfxgs5a: 'Init',
  bafkqac3gnfwc6mjpobqxsy3i: 'Payment Channel',
};

const shapeActorProps = actor => {
  const hasCode = actor.Code;
  const actorType =
    hasCode && actorTypes[actor.Code['/']]
      ? actorTypes[actor.Code['/']]
      : 'Unknown actor type';
  return {
    address: actor.address,
    code: actor.Code,
    head: actor.Head,
    nonce: actor.Nonce,
    balance: actor.Balance,
    actorType,
  };
};

const shapeMessageReceipt = messageReceipt => {
  return {
    return: messageReceipt.Return,
    gasUsed: messageReceipt.GasUsed,
    exitCode: messageReceipt.ExitCode,
  };
};

class Lotus {
  constructor({ jsonrpcEndpoint, token, initState } = {}) {
    this.store = new ObservableStore(initState);
    this.seenBlocks = new Set();
    this.seenHeights = new Set();
    this.blocksToView = [];
    this.jsonrpcEndpoint = jsonrpcEndpoint || 'http://127.0.0.1:1234/rpc/v0';
    this.token = token;
    this.fromHeight = 0;
    this.toHeight = 'latest';
  }

  lotusJSON = async (method, ...params) => {
    const { data } = await axios.post(
      this.jsonrpcEndpoint,
      {
        jsonrpc: '2.0',
        method: `Filecoin.${method}`,
        params: [...params],
        id: 1,
      },
      {
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          Accept: '*/*',
        },
      }
    );
    return data.result;
  };

  cacheBlock = block => {
    const shapedBlock = shapeBlock(block);
    const chainInState = this.store.getState();

    // first check to see if we have this height in our chain store
    if (chainInState[block.Height]) {
      // then check to see if this block exists in our chain store
      if (
        chainInState[block.Height].every(
          blockInState => blockInState.cid !== block.cid
        )
      ) {
        chainInState[block.Height].push(shapedBlock);
      }
    } else {
      chainInState[block.Height] = [shapedBlock];
    }

    this.store.putState(chainInState);
    return shapedBlock;
  };

  getChain = () => {
    return this.store.getState();
  };

  getLastPolledHeight = () => this.toHeight;

  getBlockMessages = cid =>
    this.lotusJSON('ChainGetBlockMessages', { '/': cid });

  getTipSetByHeight = height =>
    this.lotusJSON('ChainGetTipSetByHeight', height, null);

  getChainHead = () => this.lotusJSON('ChainHead');

  getParentReceipts = cid =>
    this.lotusJSON('ChainGetParentReceipts', { '/': cid });

  listActors = async (to, from) => {
    const actors = await this.lotusJSON('StateListActors', null);
    return Promise.all(
      actors.slice(to, from).map(async address => {
        const actor = await this.getActor(address);
        return actor;
      })
    );
  };

  getActor = async address => {
    const actor = await this.lotusJSON('StateGetActor', address, null);
    return shapeActorProps({ ...actor, address });
  };

  getNextBlocksFromParents = block => {
    return Promise.all(
      block.Parents
        // make sure we dont visit any parents we've already seen
        .filter(parent => !this.seenBlocks.has(parent['/']))
        .map(async parent => {
          this.seenBlocks.add(parent['/']);
          const parentBlock = await this.getBlock(parent);
          parentBlock.cid = parent['/'];
          return parentBlock;
        })
    );
  };

  handleEmptyTipset = height => {
    const chainInState = this.store.getState();
    chainInState[height] = null;
    this.store.putState(chainInState);
  };

  // fetches the tipset, creates a placeholder , visits each block in the tipset
  getNextBlocksFromTipsetByHeight = async height => {
    // get the tipset from the height we havent seen yet
    const tipset = await this.getTipSetByHeight(height);
    // if the tipset has empty blocks handle that separately
    if (tipset.Height !== height) {
      this.handleEmptyTipset(height);
      return [];
    }

    // make sure we dont fetch by this height again
    this.seenHeights.add(height);
    return (
      tipset.Blocks
        // make sure we dont visit blocks we've already seen
        .filter((_, i) => !this.seenBlocks.has(tipset.Cids[i]['/']))
        .map((block, i) => {
          // add the Cid prop to the block header for ease of use later on
          this.seenBlocks.add(tipset.Cids[i]['/']);
          return { ...block, cid: tipset.Cids[i]['/'] };
        })
    );
  };

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
        this.blocksToView = this.blocksToView.concat(
          await this.getNextBlocksFromTipsetByHeight(block.Height)
        );
      }

      // visit this block's parents
      if (block.Parents.length > 0) {
        this.blocksToView = this.blocksToView.concat(
          await this.getNextBlocksFromParents(block)
        );
      }
    }
  };

  viewBlock = async block => {
    // shape and cache the blocks in the list
    const messages = await this.getBlockMessages(block.cid);
    const parentMessageReceipts = await this.getParentReceipts(block.cid);
    block.Messages = messages;
    block.messageReceipts = parentMessageReceipts
      ? parentMessageReceipts.map(shapeMessageReceipt)
      : [];
    // mark this block as seen
    return this.cacheBlock(block);
  };

  recurse = async () => {
    while (this.blocksToView.length > 0) {
      // view blocks from right to left so we dont have to keep rebuilding the array
      const block = this.blocksToView.pop();
      await this.viewBlock(block);
      await this.addBlocksToViewList(block);
    }
  };

  explore = async (options = {}) => {
    this.toHeight = setToHeight(options.toHeight);
    this.fromHeight = setFromHeight(options.fromHeight);

    // follow web3.js pattern of allowing 'latest' for a param, which starts at the chain head
    if (this.toHeight === 'latest') {
      const { Height } = await this.getChainHead();
      // n - 1 is the first "valid" block, so explore from the latest height - 1
      return this.explore({
        toHeight: Height - 1,
        fromHeight: setFromHeight(this.fromHeight),
      });
    }

    if (this.fromHeight > this.toHeight)
      throw new Error('fromHeight must be less than toHeight');
    // loop through all the tipsets from fromHeight to toHeight, so we don't miss any mainchain blocks
    for (let i = this.fromHeight; i < this.toHeight; i++) {
      this.blocksToView.push(
        ...(await this.getNextBlocksFromTipsetByHeight(i))
      );
    }
    await Promise.all(this.blocksToView);
    await this.recurse();
    return this.toHeight;
  };

  loadNextBlocks = async num => {
    const prevFromHeight = this.fromHeight;

    for (let i = prevFromHeight - num; i < prevFromHeight; i++) {
      this.blocksToView.push(
        ...(await this.getNextBlocksFromTipsetByHeight(i))
      );
    }
    // if we attempt to load blocks but none are found, increase the bounds
    if (this.blocksToView.length === 0) {
      return this.loadNextBlocks(num + 3);
    }
    this.fromHeight = prevFromHeight - num;

    await Promise.all(this.blocksToView);
    await this.recurse();
  };

  loadSingleBlock = async cid => {
    const block = await this.getBlock({ '/': cid });
    return this.viewBlock(block);
  };

  poll = async () => {
    // start from ChainHead - 1 height
    const { Height } = await this.getChainHead();
    // start from ChainHead - 1 height
    if (this.toHeight < Height - 1) {
      await this.explore({
        fromHeight: this.toHeight,
        toHeight: Height - 1,
      });
      this.toHeight = Height - 1;
    }

    this.poller = setTimeout(async () => {
      await this.poll();
    }, 3000);
  };

  listen = () => {
    this.poll();
  };

  stopListening = () => {
    this.poller = null;
  };
}

module.exports = { Lotus, shapeBlock };
