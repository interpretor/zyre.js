const EventEmitter = require('events');
const debug = require('debug')('zyre:zyre_peer');

const CHECK_INTERVAL = 1000;
const PEER_EVASIVE = 5000;
const PEER_EXPIRED = 30000;

/**
 * The scheme of every peer hold in ZyrePeer
 *
 * @access private
 */
const SCHEME = {
  beacon: {
    address: undefined,
    port: undefined,
  },
  lastSeen: undefined,
  evasive: false,
};

module.exports = class ZyrePeer extends EventEmitter {

  /**
   * ZyrePeer holds every discovered peer and maintaines them
   *
   * @constructor
   */
  constructor() {
    super();
    this._peers = {};

    this._cleanupTimer = setInterval(() => {
      for (const i in this._peers) {
        if ({}.hasOwnProperty.call(this._peers, i)) {
          const timeDiff = Date.now() - this._peers[i].lastSeen;
          if (timeDiff >= PEER_EXPIRED) {
            delete this._peers[i];
            this.emit('expired', i, this._peers[i]);
            debug(`peer expired: ${i}`);
          } else if (timeDiff >= PEER_EVASIVE) {
            this._peers[i].evasive = true;
            this.emit('evasive', i, this._peers[i]);
            debug(`peer evasive: ${i}`);
          } else {
            this._peers[i].evasive = false;
          }
        }
      }
    }, CHECK_INTERVAL);
  }

  /**
   * Pushes a new peer object or updates an existing one
   *
   * @param {string} id
   * @param {string} key
   * @param {Object} obj
   */
  push(id, key, obj) {
    let newPeer;
    if (!this._peers[id]) {
      this._peers[id] = SCHEME;
      newPeer = true;
    }

    this._peers[id].lastSeen = Date.now();
    this._peers[id][key] = obj;

    if (newPeer) {
      this.emit('new', id, key, obj);
    }
  }

  /**
   * Get peer by id
   *
   * @param {string} id
   * @return {Object}
   */
  getPeer(id) {
    return this._peers[id];
  }

  /**
   * Get all peers
   *
   * @return {Object}
   */
  getPeers() {
    return this._peers;
  }
};
