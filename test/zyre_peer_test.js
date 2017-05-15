const assert = require('chai').assert;
const ZyrePeer = require('../lib/zyre_peer');

describe('ZyrePeer', () => {
  describe('constructor()', () => {
    it('should create an instance of ZyrePeer', () => {
      const zyrePeer = new ZyrePeer();
      assert.instanceOf(zyrePeer, ZyrePeer);
    });
  });
});
