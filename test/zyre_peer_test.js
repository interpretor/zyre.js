const assert = require('chai').assert;
const ZyrePeer = require('../lib/zyre_peer');

describe('ZyrePeer', () => {
  it('should create an instance of ZyrePeer', () => {
    const zyrePeer = new ZyrePeer({
      identity: '12345',
      address: '0.0.0.0',
      mailbox: 54321,
    });

    assert.instanceOf(zyrePeer, ZyrePeer);
  });

  it('should mark an evasive peer', function (done) {
    // Set higher timeout to test evasive peers
    this.timeout(6000);

    const identity = '12345';
    const zyrePeer = new ZyrePeer({
      identity,
      address: '0.0.0.0',
      mailbox: 54321,
    });

    zyrePeer.on('evasive', () => {
      done();
    });
  });
});
