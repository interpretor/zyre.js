const assert = require('chai').assert;
const uuid = require('uuid');
const ZyrePeers = require('../lib/zyre_peers');
const ZyreNode = require('../lib/zyre_node');
const ZHelper = require('../lib/zhelper');

describe('ZyreNode', () => {
  it('should create an instance of ZyreNode', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, this._identity, 0);
    const zyreNode = new ZyreNode({
      identity,
      name: 'foo',
      mailbox: 54321,
      ifaceData: ZHelper.getIfData(),
      zyrePeers: new ZyrePeers(),
    });

    assert.instanceOf(zyreNode, ZyreNode);
  });
});
