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
 * ZyrePeers manages all ZyrePeer objects.
 *
 * @extends EventEmitter
 */
class ZyrePeers extends EventEmitter {
  /**
   * @param {object} options - Options object
   * @param {Buffer} options.identity - 16 byte UUID as Buffer
   * @param {number} [options.evasive] - Evasive timeout in ms
   * @param {number} [options.expired] - Expired timeout in ms
   */
  constructor({ identity, evasive, expired }) {
    super();

    this._identity = identity;
    this._evasive = evasive;
    this._expired = expired;
    this._peers = {};

    this._createHandler();
  }

  /**
   * Returns a ZyrePeer with the given identity.
   *
   * @param {string} identity - Identity of the peer
   * @return {ZyrePeer}
   */
  getPeer(identity) {
    return this._peers[identity];
  }

  /**
   * Returns true if a ZyrePeer with the given identity exists.
   *
   * @param {string} identity - Identity of the peer
   * @return {boolean}
   */
  exists(identity) {
    if (typeof this._peers[identity] !== 'undefined') return true;
    return false;
  }

  /**
   * Updates the ZyrePeer information, creates a new ZyrePeer if it doesn't exist yet.
   *
   * @fires ZyrePeers#new
   * @fires ZyrePeers#expired
   * @fires ZyrePeers#disconnect
   * @param {object} options - Options object
   * @param {string} options.identity - Identity of the peer
   * @param {number} [options.sequence] - Sequence of the last received message
   * @param {string} [options.address] - IP of the peer
   * @param {number} [options.mailbox] - Network port of the peer
   * @param {string} [options.endpoint] - TCP address of the peer
   * @param {number} [options.status] - Group status of the peer
   * @param {string} [options.name] - Name of the peer
   * @param {object} [options.headers] - Headers of the peer
   * @return {ZyrePeer}
   */
  push({ identity, sequence, address, mailbox, endpoint, status, name, headers }) {
    let newPeer = false;

    if (!this.exists(identity)) {
      newPeer = true;

      const zyrePeer = new ZyrePeer({
        identity,
        originID: this._identity,
        evasive: this._evasive,
        expired: this._expired,
      });

      zyrePeer.on('expired', this._expiredHandler);
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

    if (newPeer && typeof zyrePeer !== 'undefined') this._newPeerHandler(zyrePeer);

    return zyrePeer;
  }

  /**
   * Disconnects from and closes the socket of all peers. Removes all peers from the known peers.
   * Loses all pending messages of all peers, so only use if the environment changes or the
   * application closes.
   */
  disconnectAll() {
    Object.keys(this._peers).forEach((i) => {
      this._peers[i].disconnect();
    });
  }

  /**
   * Sends a ZreMsg message to all known ZyrePeers.
   *
   * @param {ZreMsg} msg - ZreMsg
   */
  send(msg) {
    Object.keys(this._peers).forEach((i) => {
      this._peers[i].send(msg);
    });
  }

  /**
   * @typedef {object} PeersObject
   * @property {PeerObject}
   */

  /**
   * Creates an object with public data of all peers.
   *
   * @return {PeersObject}
   */
  toObj() {
    const obj = {};

    Object.keys(this._peers).forEach((i) => {
      obj[i] = this._peers[i].toObj();
    });

    return obj;
  }

  /**
   * Creates handler as object properties in a separate method to ensure proper scope via arrow
   * functions.
   *
   * @protected
   */
  _createHandler() {
    this._newPeerHandler = (zyrePeer) => {
      /**
       * @event ZyrePeers#new
       * @property {ZyrePeer} - ZyrePeer
       */
      this.emit('new', zyrePeer);
    };

    this._expiredHandler = (zyrePeer) => {
      /**
       * @event ZyrePeers#expired
       * @property {ZyrePeer} - ZyrePeer
       */
      this.emit('expired', zyrePeer);
    };

    this._disconnectHandler = (zyrePeer) => {
      zyrePeer.removeListener('expired', this._expiredHandler);
      zyrePeer.removeListener('disconnect', this._disconnectHandler);
      delete this._peers[zyrePeer.getIdentity()];
      /**
       * @event ZyrePeers#disconnect
       * @property {ZyrePeer} - ZyrePeer
       */
      this.emit('disconnect', zyrePeer);
    };
  }
}

module.exports = ZyrePeers;
