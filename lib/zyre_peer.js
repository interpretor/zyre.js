const EventEmitter = require('events');
const debug = require('debug')('zyre:zyre_peer');

const CHECK_INTERVAL = 1000;
const PEER_EVASIVE = 5000;
const PEER_EXPIRED = 30000;

const SCHEME = {
  beacon: {
    address: undefined,
    port: undefined,
  },
  lastSeen: undefined,
  evasive: false,
};

module.exports = class ZyrePeer extends EventEmitter {

  constructor() {
    super();
    this.peers = {};

    this.cleanup = setInterval(() => {
      Object.entries(this.peers).forEach((i) => {
        const timeDiff = Date.now() - i[1].lastSeen;
        if (timeDiff >= PEER_EXPIRED) {
          delete this.peers[i[0]];
          this.emit('expired', i[0], i[1]);
          debug(`peer expired: ${i[0]}`);
        } else if (timeDiff >= PEER_EVASIVE) {
          this.peers[i[0]].evasive = true;
          this.emit('evasive', i[0], i[1]);
          debug(`peer evasive: ${i[0]}`);
        } else {
          this.peers[i[0]].evasive = false;
        }
      });
    }, CHECK_INTERVAL);
  }

  push(id, key, peer) {
    let newPeer;
    if (!this.peers[id]) {
      this.peers[id] = SCHEME;
      newPeer = true;
    }

    this.peers[id].lastSeen = Date.now();
    this.peers[id][key] = peer;

    if (newPeer) {
      this.emit('new', id, key, peer);
    }
  }
};
