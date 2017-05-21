const EventEmitter = require('events');
const ZyrePeer = require('./zyre_peer');

module.exports = class ZyrePeers extends EventEmitter {

  constructor(identity) {
    super();

    this._identity = identity;
    this._peers = {};
  }

  push({ identity, sequence, address, mailbox, endpoint, status, name, headers }) {
    if (this._peers[identity]) {
      this._peers[identity].update({ sequence, address, mailbox, endpoint, status, name, headers });
    } else {
      const zyrePeer = new ZyrePeer({
        identity,
        sequence,
        address,
        mailbox,
        endpoint,
        status,
        name,
        headers,
        originID: this._identity,
      });

      zyrePeer.on('evasive', () => {
        this.emit('evasive', zyrePeer);
      });

      zyrePeer.on('expired', () => {
        this.emit('expired', zyrePeer);
        delete this._peers[identity];
      });

      this._peers[identity] = zyrePeer;
      this.emit('new', zyrePeer);
    }
  }

  getPeer(identity) {
    return this._peers[identity];
  }
};
