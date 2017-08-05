/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const EventEmitter = require('events');
const debug = require('debug')('zyre:zyre_peer');
const zeromq = require('zeromq');
const ZreMsg = require('./zre_msg');

const ID_PREFIX = 1;

/**
 * ZyrePeer represents a foreign peer in the network.
 *
 * @extends EventEmitter
 */
class ZyrePeer extends EventEmitter {
  /**
   * @param {object} options - Options object
   * @param {string} options.identity - Identity of the peer
   * @param {Buffer} options.originID - 16 byte UUID as Buffer
   * @param {number} [options.evasive=5000] - Evasive timeout in ms
   * @param {number} [options.expired=30000] - Expired timeout in ms
   */
  constructor({ identity, originID, evasive = 5000, expired = 30000 }) {
    super();

    this._identity = identity;
    this._originID = originID;
    this._evasive = evasive;
    this._expired = expired;
    this._groups = {};
    this._connected = false;
    this._sequenceIn = 0;
    this._sequenceOut = 0;
    this._evasiveAt = 0;

    this._createHandler();
  }

  /**
   * @return {string} Identity of the peer
   */
  getIdentity() {
    return this._identity;
  }

  /**
   * @return {string} Name of the peer
   */
  getName() {
    return this._name;
  }

  /**
   * @return {object} Headers of the peer
   */
  getHeaders() {
    return this._headers;
  }

  /**
   * Adds this ZyrePeer to a given ZyreGroup.
   *
   * @param {ZyreGroup} group - ZyreGroup
   */
  addToGroup(group) {
    if (typeof this._groups[group.getName()] === 'undefined') {
      this._groups[group.getName()] = group;
      group.add(this);
    }
  }

  /**
   * Removes this ZyrePeer from a given ZyreGroup.
   *
   * @param {ZyreGroup} group - ZyreGroup
   */
  removeFromGroup(group) {
    if (typeof this._groups[group.getName()] !== 'undefined') {
      delete this._groups[group.getName()];
      group.remove(this);
    }
  }

  /**
   * Connects to this ZyrePeer.
   */
  connect() {
    if (typeof this._socket === 'undefined') {
      this._socket = zeromq.socket('dealer');
      const sockIdentity = Buffer.concat([Buffer.from([ID_PREFIX]), this._originID]);

      this._socket.setsockopt(zeromq.ZMQ_IDENTITY, sockIdentity);
      this._socket.setsockopt(zeromq.ZMQ_LINGER, 0);
      this._socket.connect(this._endpoint);
    }

    this._connected = true;
    debug(`${this._identity}: connected`);
  }

  /**
   * Disconnects from this ZyrePeer and stops every activity. Closes the zeromq dealer socket. Loses
   * all pending messages, so only use when the peer should be permanently removed.
   *
   * @fires ZyrePeer#disconnect
   */
  disconnect() {
    this._connected = false;
    this._clearTimeouts();

    Object.keys(this._groups).forEach((i) => {
      this.removeFromGroup(this._groups[i]);
    });

    if (typeof this._socket !== 'undefined') {
      this._socket.close();
      this._socket = undefined;
    }

    debug(`${this._identity}: disconnected`);
    /**
     * @event ZyrePeer#disconnect
     * @property {ZyrePeer} zyrePeer - ZyrePeer
     */
    this.emit('disconnect', this);
  }

  /**
   * Sends a ZreMsg to this ZyrePeer.
   *
   * @param {ZreMsg} msg - ZreMsg
   */
  send(msg) {
    if (this._connected) {
      this._sequenceOut = (this._sequenceOut + 1) % 65535;
      msg.setSequence(this._sequenceOut);
      msg.send(this._socket).then((cmd) => {
        debug(`${this._identity}: sent message (${cmd}), seq (${this._sequenceOut})`);
      });
    }
  }

  /**
   * Updates the data of this ZyrePeer, manages timeouts for evasive and expired.
   *
   * @fires ZyrePeer#expired
   * @fires ZyrePeer#disconnect
   * @param {object} options - Options object
   * @param {number} [options.sequence] - Sequence of the last received message
   * @param {string} [options.address] - IP of the peer
   * @param {number} [options.mailbox] - Network port of the peer
   * @param {string} [options.endpoint] - TCP address of the peer
   * @param {number} [options.status] - Group status of the peer
   * @param {string} [options.name] - Name of the peer
   * @param {object} [options.headers] - Headers of the peer
   * @return {ZyrePeer}
   */
  update({ sequence, address, mailbox, endpoint, status, name, headers }) {
    if (!this._setSequence(sequence)) return undefined;
    if (!this._setAddress(address, mailbox)) return undefined;

    this._setEndpoint(endpoint);
    this._setStatus(status);
    this._setName(name);
    this._setHeaders(headers);

    this._clearTimeouts();
    this._setTimeouts();

    return this;
  }

  /**
   * @typedef {object} PeerObject
   * @property {string} name
   * @property {string} endpoint
   * @property {object} headers
   * @property {string[]} groups
   * @property {boolean} evasive
   */

  /**
   * Creates an object with public data of this peer.
   *
   * @return {PeerObject}
   */
  toObj() {
    const obj = {};
    obj.name = this._name;
    obj.endpoint = this._endpoint;
    obj.headers = this._headers;
    obj.groups = [];

    Object.keys(this._groups).forEach((i) => {
      obj.groups.push(i);
    });

    obj.evasive = this._evasiveAt > 0;

    return obj;
  }

  /**
   * Sets the sequence number of the last received message. Disconnects from the peer and returns
   * false if the sequence number does not equal the expected one.
   *
   * @protected
   * @fires ZyrePeer#disconnect
   * @param {number} sequence - Sequence of the last received message
   * @return {boolean}
   */
  _setSequence(sequence) {
    if (typeof sequence !== 'undefined') {
      const expectedSeq = (this._sequenceIn + 1) % 65535;

      // Disconnect on wrong sequence number
      if (sequence !== expectedSeq) {
        debug(`${this._identity}: wrong sequence (${sequence}), expected (${expectedSeq})`);
        this.disconnect();
        return false;
      }

      this._sequenceIn = sequence;
    }

    return true;
  }

  /**
   * Sets the endpoint of the peer if it isn't connected yet. Disconnects from the peer and
   * returns false if the received mailbox port equals 0.
   *
   * @protected
   * @fires ZyrePeer#disconnect
   * @param {string} address - IP of the peer
   * @param {number} mailbox - Network port of the peer
   * @return {boolean}
   */
  _setAddress(address, mailbox) {
    if (typeof address !== 'undefined' && typeof mailbox !== 'undefined') {
      // If received a message with mailbox set to 0, disconnect from the peer (zre beacon protocol)
      if (mailbox === 0) {
        debug(`${this._identity}: received disconnect beacon`);
        this.disconnect();
        return false;
      }

      if (!this._connected) this._endpoint = `tcp://${address}:${mailbox}`;
    }

    return true;
  }

  /**
   * @protected
   * @param {string} endpoint - TCP address of the peer
   */
  _setEndpoint(endpoint) {
    if (typeof endpoint !== 'undefined' && !this._connected) this._endpoint = endpoint;
  }

  /**
   * @protected
   * @param {number} status - Group status of the peer
   */
  _setStatus(status) {
    if (typeof status !== 'undefined') this._status = status;
  }

  /**
   * @protected
   * @param {string} name - Name of the peer
   */
  _setName(name) {
    if (typeof name !== 'undefined') this._name = name;
  }

  /**
   * @protected
   * @param {object} headers - Headers of the peer
   */
  _setHeaders(headers) {
    if (typeof headers !== 'undefined') this._headers = headers;
  }

  /**
   * Sets timeouts for evasive and expired.
   *
   * @protected
   * @fires ZyrePeer#expired
   * @fires ZyrePeer#disconnect
   */
  _setTimeouts() {
    // Reset the evasive status when restarting the timeouts
    this._evasiveAt = 0;

    this._evasiveTimeout = setTimeout(this._evasiveHandler, this._evasive);
    this._expiredTimeout = setTimeout(this._expiredHandler, this._expired);
  }

  /**
   * Clears the evasive and expired timeouts.
   *
   * @protected
   */
  _clearTimeouts() {
    clearTimeout(this._evasiveTimeout);
    clearTimeout(this._expiredTimeout);
  }

  /**
   * Creates handler as object properties in a separate method to ensure proper scope via arrow
   * functions.
   *
   * @protected
   */
  _createHandler() {
    /**
     * Send PING message to evasive peer to check if it is still alive.
     *
     * @protected
     */
    this._evasiveHandler = () => {
      this._evasiveAt = Date.now();
      debug(`${this._identity}: evasive at ${this._evasiveAt}`);
      this.send(new ZreMsg(ZreMsg.PING));
    };

    /**
     * Disconnect from the peer when it is expired.
     *
     * @protected
     * @fires ZyrePeer#expired
     * @fires ZyrePeer#disconnect
     */
    this._expiredHandler = () => {
      debug(`${this._identity}: expired at ${Date.now()}`);
      /**
       * @event ZyrePeer#expired
       * @property {ZyrePeer} zyrePeer - ZyrePeer
       */
      this.emit('expired', this);
      this.disconnect();
    };
  }
}

module.exports = ZyrePeer;
