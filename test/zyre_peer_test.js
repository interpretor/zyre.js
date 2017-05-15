const assert = require('chai').assert;
const ZyrePeer = require('../lib/zyre_peer');

describe('ZyrePeer', () => {
  describe('constructor()', () => {
    it('should create an instance of ZyrePeer', () => {
      const zyrePeer = new ZyrePeer();
      assert.instanceOf(zyrePeer, ZyrePeer);
    });
  });

  describe('push()', () => {
    it('should add an object to the peers object', () => {
      const zyrePeer = new ZyrePeer();
      const obj = {
        beacon: {
          address: '1.2.3.4',
          port: 12345,
        },
      };
      zyrePeer.push('foo', 'beacon', obj);
      assert.isDefined(zyrePeer.peers.foo.lastSeen);
    });
  });
});
