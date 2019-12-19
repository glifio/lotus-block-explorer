export const setToHeight = height => {
  if (!height) return 'latest'
  if (typeof height === 'string' && typeof Number(height) === 'number')
    return Number(height)
  if (typeof height === 'number') return height
  throw new Error('unhandled setToHeight case')
}

export const setFromHeight = height => {
  if (!height) return 0
  if (typeof height === 'string' && typeof Number(height) === 'number')
    return Number(height)
  if (typeof height === 'number') return height
  throw new Error('unhandled setFromHeight case')
}

export const shapeBlock = block => {
  const { BlsMessages, SecpkMessages } = block.Messages

  const messages = [
    ...BlsMessages.map(m => ({ ...m, type: 'BlsMessage' })),
    ...SecpkMessages.map(m => ({ ...m, type: 'SecpkMessage' })),
  ]

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
    messages,
    messageReceipts: block.messageReceipts,
  }
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

export const shapeActorProps = actor => {
  const hasCode = actor.Code
  const actorType =
    hasCode && actorTypes[actor.Code['/']]
      ? actorTypes[actor.Code['/']]
      : 'Unknown actor type'
  return {
    address: actor.address,
    code: actor.Code,
    head: actor.Head,
    nonce: actor.Nonce,
    balance: actor.Balance,
    actorType,
  }
}

export const shapeMessageReceipt = messageReceipt => {
  return {
    return: messageReceipt.Return,
    gasUsed: messageReceipt.GasUsed,
    exitCode: messageReceipt.ExitCode,
  }
}
