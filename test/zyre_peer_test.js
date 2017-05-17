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
    assert.isDefined(zyrePeer.getPeers().foo);
  });

  it('should mark an evasive object as evasive', function mocha(done) {
    // Set higher timeout to test evasive peers
    this.timeout(6000);

    const zyrePeer = new ZyrePeer();
    const obj = {
      address: '1.2.3.4.',
      port: 12345,
    };
    zyrePeer.push('foo', 'beacon', obj);

    zyrePeer.on('evasive', (id, peer) => {
      assert.equal(id, 'foo');
      assert.deepEqual(peer.beacon, obj);
      assert.equal(peer.evasive, true);
      done();
    });
  });
});
