/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const EventEmitter = require('events');
const ZyrePeer = require('./zyre_peer');

/**
 * ZyrePeers manages all ZyrePeer objects
 */
class ZyrePeers extends EventEmitter {

  /**
   * @param {Buffer} identity - 16 byte UUID as Buffer
   */
  constructor(identity) {
    super();

    this._identity = identity;
    this._peers = {};
  }

  /**
   * Returns a ZyrePeer from the given identity
   *
   * @param {string} identity - Identity of the peer
   * @return {ZyrePeer}
   */
  getPeer(identity) {
    return this._peers[identity];
  }

  /**
   * Updates the ZyrePeer information; Creates a new ZyrePeer if it doesn't exist yet.
   *
   * @param {Object} options - Options Object
   * @param {string} options.identity - Identity of the peer
   * @param {number} [options.sequence] - Sequence of the last received message
   * @param {string} [options.address] - IP of the peer
   * @param {number} [options.mailbox] - Network port of the peer
   * @param {string} [options.endpoint] - TCP address of the peer
   * @param {number} [options.status] - Group status of the peer
   * @param {string} [options.name] - Name of the peer
   * @param {Object} [options.headers] - Headers of the peer
   */
  push({ identity, sequence, address, mailbox, endpoint, status, name, headers }) {
    let newPeer = false;

    // If new peer
    if (!this._peers[identity]) {
      newPeer = true;

      const zyrePeer = new ZyrePeer({
        identity,
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
    }

    this._peers[identity].update({ sequence, address, mailbox, endpoint, status, name, headers });

    if (newPeer) this.emit('new', this._peers[identity]);
  }

  /**
   * Sends a ZreMsg message to all known ZyrePeers
   *
   * @param {ZreMsg} msg - ZreMsg to send
   */
  send(msg) {
    for (const i in this._peers) {
      if ({}.hasOwnProperty.call(this._peers, i)) {
        this._peers[i].send(msg);
      }
    }
  }
}

module.exports = ZyrePeers;
