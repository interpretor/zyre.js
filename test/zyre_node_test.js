const assert = require('chai').assert;
const ZyreNode = require('../lib/zyre_node');

describe('ZyreNode', () => {
  describe('constructor()', () => {
    it('should create an instance of ZyreNode', () => {
      const zyreNode = new ZyreNode();
      assert.instanceOf(zyreNode, ZyreNode);
    });
  });
});
