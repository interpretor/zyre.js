const assert = require('chai').assert;
const ZyrePeer = require('../lib/zyre_peer');

describe('ZyrePeer', () => {
  it('should create an instance of ZyrePeer', () => {
    const zyrePeer = new ZyrePeer();
    assert.instanceOf(zyrePeer, ZyrePeer);
  });

  it('should add an object to the peers object', () => {
    const zyrePeer = new ZyrePeer();
    const obj = {
      address: '1.2.3.4',
      port: 12345,
    };
    zyrePeer.push('foo', 'beacon', obj);
    assert.isDefined(zyrePeer.getPeer('foo'));
  });
});
