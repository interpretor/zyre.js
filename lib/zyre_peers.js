const EventEmitter = require('events');
const ZyrePeer = require('./zyre_peer');

module.exports = class ZyrePeers extends EventEmitter {

  constructor(identity) {
    super();

    this._identity = identity;
    this._peers = {};
  }

  push({ identity, name, address, mailbox }) {
    if (this._peers[identity]) {
      this._peers[identity].update({ identity, name, address, mailbox });
    } else {
      const zyrePeer = new ZyrePeer({
        identity,
        name,
        address,
        mailbox,
        originID: this._identity,
      });
      this._peers[identity] = zyrePeer;
      this.emit('new', zyrePeer);
    }

    this._peers[identity].on('evasive', () => {
      this.emit('evasive', this._peers[identity]);
    });

    this._peers[identity].on('expired', () => {
      this.emit('expired', this._peers[identity]);
    });
  }

  getPeer(identity) {
    return this._peers[identity];
  }
};
