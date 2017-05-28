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
 *
 * @extends EventEmitter
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
   * @return {ZyrePeer} The pushed ZyrePeer
   */
  push({ identity, sequence, address, mailbox, endpoint, status, name, headers }) {
    // If received a message with mailbox === 0, disconnect from that peer (zbeacon)
    if (mailbox === 0) {
      if (this._peers[identity]) this.emit('disconnect', this._peers[identity]);
      this.remove(identity);
      return undefined;
    }

    let newPeer = false;
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
        this.remove(identity);
      });

      this._peers[identity] = zyrePeer;
    }

    const zyrePeer = this._peers[identity].update({
      sequence,
      address,
      mailbox,
      endpoint,
      status,
      name,
      headers,
    });

    if (newPeer && zyrePeer) this.emit('new', zyrePeer);

    return zyrePeer;
  }

  /**
   * Disconnect from the given peer and stops his activity
   *
   * @param {string} identity - Identity of the peer
   */
  remove(identity) {
    if (this._peers[identity]) {
      this._peers[identity].removeAllListeners();
      this._peers[identity].disconnect();
      delete this._peers[identity];
    }
  }

  /**
   * Disconnects from all peers and stops their activity
   */
  removeAll() {
    for (const i in this._peers) {
      if ({}.hasOwnProperty.call(this._peers, i)) {
        this.remove(i);
      }
    }
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

  /**
   * @typedef {Object} PeersObject
   * @property {PeerObject}
   */

  /**
   * Creates an object with public data of all peers
   *
   * @return {PeersObject}
   */
  toObj() {
    const obj = {};
    for (const i in this._peers) {
      if ({}.hasOwnProperty.call(this._peers, i)) {
        obj[i] = this._peers[i].toObj();
      }
    }

    return obj;
  }
}

module.exports = ZyrePeers;
