const EventEmitter = require('events');
const ZyrePeer = require('./zyre_peer');

module.exports = class ZyrePeers extends EventEmitter {

  constructor(identity) {
    super();

    this._identity = identity;
    this._peers = {};
  }

  push({ identity, name, address, mailbox, endpoint, groups, sequence }) {
    if (this._peers[identity]) {
      this._peers[identity].update({
        name,
        address,
        mailbox,
        endpoint,
        groups,
        sequence,
      });
    } else {
      const zyrePeer = new ZyrePeer({
        identity,
        name,
        address,
        mailbox,
        endpoint,
        groups,
        sequence,
        originID: this._identity,
      });

      zyrePeer.on('evasive', () => {
        this.emit('evasive', zyrePeer);
      });

      zyrePeer.on('expired', () => {
        this.emit('expired', zyrePeer);
      });

      this._peers[identity] = zyrePeer;
      this.emit('new', zyrePeer);
    }
  }

  getPeer(identity) {
    return this._peers[identity];
  }
};
