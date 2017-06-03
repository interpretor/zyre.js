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

const PEER_EVASIVE = 5000;
const PEER_EXPIRED = 10000;

const ID_PREFIX = 1;

/**
 * ZyrePeer represents a foreign peer in the network
 *
 * @extends EventEmitter
 */
class ZyrePeer extends EventEmitter {

  /**
   * @param {Object} options - Options Object
   * @param {string} options.identity - Identity of the peer
   * @param {Buffer} options.originID - 16 byte UUID as Buffer
   */
  constructor({ identity, originID }) {
    super();

    this._identity = identity;
    this._originID = originID;
    this._sequenceIn = 0;
    this._sequenceOut = 0;
    this._groups = {};
    this._connected = false;
    this._evasiveAt = 0;
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
   * @return {number} Sequence of the last received message
   */
  getSequence() {
    return this._sequenceIn;
  }

  /**
   * Adds this ZyrePeer to a given ZyreGroup
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
   * Removes this ZyrePeer from a given ZyreGroup
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
   * Connects to this ZyrePeer
   */
  connect() {
    if (!this._connected) {
      this._socket = zeromq.socket('dealer', {
        identity: Buffer.concat([Buffer.from([ID_PREFIX]), this._originID]),
      });

      this._socket.setsockopt(zeromq.ZMQ_LINGER, 0);
      this._socket.setsockopt(zeromq.ZMQ_SNDHWM, PEER_EXPIRED / 10);
      this._socket.setsockopt(zeromq.ZMQ_SNDTIMEO, 0);

      this._socket.connect(this._endpoint);
      this._connected = true;
    }

    debug(`${this._identity}: connected`);
  }

  /**
   * Disconnects from this ZyrePeer and stops every activity
   */
  disconnect() {
    this._clearTimeouts();

    for (const i in this._groups) {
      if ({}.hasOwnProperty.call(this._groups, i)) {
        this.removeFromGroup(this._groups[i]);
      }
    }

    if (this._connected) {
      this._socket.close();
      this._connected = false;
    }

    debug(`${this._identity}: disconnected`);
  }

  /**
   * Sends a ZreMsg to this ZyrePeer
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
   * Updates the data of this ZyrePeer, manages timeouts for evasive and expired
   *
   * @fires ZyrePeer#disconnect
   * @fires ZyrePeer#back
   * @fires ZyrePeer#evasive
   * @fires ZyrePeer#expired
   * @param {Object} options - Options Object
   * @param {number} [options.sequence] - Sequence of the last received message
   * @param {string} [options.address] - IP of the peer
   * @param {number} [options.mailbox] - Network port of the peer
   * @param {string} [options.endpoint] - TCP address of the peer
   * @param {number} [options.status] - Group status of the peer
   * @param {string} [options.name] - Name of the peer
   * @param {Object} [options.headers] - Headers of the peer
   * @return {ZyrePeer}
   */
  update({ sequence, address, mailbox, endpoint, status, name, headers }) {
    if (typeof sequence !== 'undefined') {
      // Disconnect on wrong sequence number
      const expectedSeq = (this._sequenceIn + 1) % 65535;
      if (sequence !== expectedSeq) {
        debug(`${this._identity}: wrong sequence (${sequence}), expected (${expectedSeq})`);
        /**
         * @event ZyrePeer#disconnect
         * @property {ZyrePeer} zyrePeer - ZyrePeer
         */
        this.emit('disconnect', this);
        return undefined;
      }

      this._sequenceIn = sequence;
    }

    if (typeof address !== 'undefined' && typeof mailbox !== 'undefined') {
      // If received a message with mailbox === 0, disconnect from the peer (zre beacon protocol)
      if (mailbox === 0) {
        debug(`${this._identity}: received disconnect beacon`);
        /**
         * @event ZyrePeer#disconnect
         * @property {ZyrePeer} zyrePeer - ZyrePeer
         */
        this.emit('disconnect', this);
        return undefined;
      }

      this._endpoint = `tcp://${address}:${mailbox}`;
    } else if (typeof endpoint !== 'undefined') {
      this._endpoint = endpoint;
    }

    if (typeof status !== 'undefined') this._status = status;
    if (typeof name !== 'undefined') this._name = name;
    if (typeof headers !== 'undefined') this._headers = headers;

    if (this._evasiveAt > 0) {
      this._evasiveAt = 0;
      debug(`${this._identity}: back from being evasive`);
      /**
       * @event ZyrePeer#back
       * @property {ZyrePeer} zyrePeer - ZyrePeer
       */
      this.emit('back', this);
    }

    this._clearTimeouts();
    this._setTimeouts();

    return this;
  }

  /**
   * Sets timeouts for evasive and expired
   *
   * @protected
   */
  _setTimeouts() {
    this._evasiveTimeout = setTimeout(() => {
      this._evasiveAt = Date.now();
      debug(`${this._identity}: evasive at ${this._evasiveAt}`);
      /**
       * @event ZyrePeer#evasive
       * @property {ZyrePeer} zyrePeer - ZyrePeer
       */
      this.emit('evasive', this);

      this.send(new ZreMsg(ZreMsg.PING));
    }, PEER_EVASIVE);

    this._expiredTimeout = setTimeout(() => {
      debug(`${this._identity}: expired at ${Date.now()}`);
      /**
       * @event ZyrePeer#expired
       * @property {ZyrePeer} zyrePeer - ZyrePeer
       */
      this.emit('expired', this);
    }, PEER_EXPIRED);
  }

  /**
   * Clears the evasive and expired timeouts
   *
   * @protected
   */
  _clearTimeouts() {
    clearTimeout(this._evasiveTimeout);
    clearTimeout(this._expiredTimeout);
  }

  /**
   * @typedef {Object} PeerObject
   * @property {string} name
   * @property {string} endpoint
   * @property {Object} headers
   * @property {string[]} groups
   */

  /**
   * Creates an object with public data of this peer
   *
   * @return {PeerObject}
   */
  toObj() {
    const obj = {};
    obj.name = this._name;
    obj.endpoint = this._endpoint;
    obj.headers = this._headers;
    obj.groups = [];
    for (const i in this._groups) {
      if ({}.hasOwnProperty.call(this._groups, i)) {
        obj.groups.push(i);
      }
    }

    return obj;
  }
}

ZyrePeer.PEER_EVASIVE = PEER_EVASIVE;
ZyrePeer.PEER_EXPIRED = PEER_EXPIRED;

module.exports = ZyrePeer;
