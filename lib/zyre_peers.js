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

    this._createHandler();
  }

  /**
   * Returns a ZyrePeer with the given identity
   *
   * @param {string} identity - Identity of the peer
   * @return {ZyrePeer}
   */
  getPeer(identity) {
    return this._peers[identity];
  }

  /**
   * Returns true if a ZyrePeer with the given identity exists
   *
   * @param {string} identity - Identity of the peer
   * @return {boolean}
   */
  exists(identity) {
    if (typeof this._peers[identity] !== 'undefined') return true;
    return false;
  }

  /**
   * Updates the ZyrePeer information, creates a new ZyrePeer if it doesn't exist yet
   *
   * @fires ZyrePeers#evasive
   * @fires ZyrePeers#expired
   * @fires ZyrePeers#back
   * @fires ZyrePeers#disconnect
   * @fires ZyrePeers#new
   * @param {Object} options - Options Object
   * @param {string} options.identity - Identity of the peer
   * @param {number} [options.sequence] - Sequence of the last received message
   * @param {string} [options.address] - IP of the peer
   * @param {number} [options.mailbox] - Network port of the peer
   * @param {string} [options.endpoint] - TCP address of the peer
   * @param {number} [options.status] - Group status of the peer
   * @param {string} [options.name] - Name of the peer
   * @param {Object} [options.headers] - Headers of the peer
   * @return {ZyrePeer}
   */
  push({ identity, sequence, address, mailbox, endpoint, status, name, headers }) {
    let newPeer = false;
    if (!this.exists(identity)) {
      newPeer = true;

      const zyrePeer = new ZyrePeer({
        identity,
        originID: this._identity,
      });

      zyrePeer.on('evasive', this._evasiveHandler);
      zyrePeer.on('expired', this._expiredHandler);
      zyrePeer.on('back', this._backHandler);
      zyrePeer.on('disconnect', this._disconnectHandler);

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

    if (newPeer && typeof zyrePeer !== 'undefined') {
      /**
       * @event ZyrePeers#new
       * @property {ZyrePeer} - ZyrePeer
       */
      this.emit('new', zyrePeer);
    }

    return zyrePeer;
  }

  /**
   * Disconnect from the peer with the given identity and stops his activity
   *
   * @param {string} identity - Identity of the peer
   */
  disconnect(identity) {
    if (this.exists(identity)) {
      this._peers[identity].disconnect();
      this._peers[identity].removeAllListeners();
      delete this._peers[identity];
    }
  }

  /**
   * Disconnects from all peers and stops their activities
   */
  disconnectAll() {
    for (const i in this._peers) {
      if ({}.hasOwnProperty.call(this._peers, i)) {
        this.disconnect(i);
      }
    }
  }

  /**
   * Sends a ZreMsg message to all known ZyrePeers
   *
   * @param {ZreMsg} msg - ZreMsg
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

  /**
   * Creates handler as object properties in a separate method to ensure proper scope via arrow
   * functions
   */
  _createHandler() {
    this._evasiveHandler = (zyrePeer) => {
      /**
       * @event ZyrePeers#evasive
       * @property {ZyrePeer} - ZyrePeer
       */
      this.emit('evasive', zyrePeer);
    };

    this._expiredHandler = (zyrePeer) => {
      /**
       * @event ZyrePeers#expired
       * @property {ZyrePeer} - ZyrePeer
       */
      this.disconnect(zyrePeer.getIdentity());
      this.emit('expired', zyrePeer);
    };

    this._backHandler = (zyrePeer) => {
      /**
       * @event ZyrePeers#back
       * @property {ZyrePeer} - ZyrePeer
       */
      this.emit('back', zyrePeer);
    };

    this._disconnectHandler = (zyrePeer) => {
      /**
       * @event ZyrePeers#disconnect
       * @property {ZyrePeer} - ZyrePeer
       */
      this.disconnect(zyrePeer.getIdentity());
      this.emit('disconnect', zyrePeer);
    };
  }
}

module.exports = ZyrePeers;
