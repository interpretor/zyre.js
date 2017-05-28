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
const ZyreGroup = require('./zyre_group');
const ZreMsg = require('./zre_msg');

const PEER_EVASIVE = 5000;
const PEER_EXPIRED = 10000;

const ID_PREFIX = 1;

/**
 * ZyrePeer represents a foreign peer in a network
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
   * @return {string} - Identity of the peer
   */
  getIdentity() {
    return this._identity;
  }

  /**
   * @return {number} - Sequence of the last received message
   */
  getSequence() {
    return this._sequenceIn;
  }

  /**
   * @return {string} - Name of the peer
   */
  getName() {
    return this._name;
  }

  /**
   * @return {boolean} - Connected or not connected
   */
  connected() {
    return this._connected;
  }

  /**
   * Adds a ZyreGroup to this ZyrePeer
   *
   * @param {ZyreGroup} group - The ZyreGroup to add
   */
  addGroup(group) {
    if (group instanceof ZyreGroup) {
      this._groups[group.getName()] = group;
    }
  }

  /**
   * Removes a ZyreGroup from this ZyrePeer
   *
   * @param {ZyreGroup} group - The ZyreGroup to remove
   */
  removeGroup(group) {
    if (group instanceof ZyreGroup) {
      delete this._groups[group.getName()];
    }
  }

  /**
   * Connects to this ZyrePeer
   */
  connect() {
    this._socket = zeromq.socket('dealer', {
      identity: Buffer.concat([Buffer.from([ID_PREFIX]), this._originID]),
    });

    this._socket.connect(this._endpoint);
    this._connected = true;
    debug(`${this._identity}: connected`);
  }

  /**
   * Disconnects from this ZyrePeer and stops every activity
   */
  disconnect() {
    this._clearTimeouts();
    for (const i in this._groups) {
      if ({}.hasOwnProperty.call(this._groups, i)) {
        this._groups[i].remove(this);
        this.removeGroup(this._groups[i]);
      }
    }

    if (this._connected) {
      this._socket.disconnect(this._endpoint);
      this._socket.close();
      this._connected = false;
    }

    debug(`${this._identity}: disconnected`);
  }

  /**
   * Sends a ZreMsg to this ZyrePeer
   *
   * @param {ZreMsg} msg - ZreMsg to send
   */
  send(msg) {
    if (this._connected && msg instanceof ZreMsg) {
      this._sequenceOut = (this._sequenceOut + 1) % 65536;
      msg.setSequence(this._sequenceOut);
      msg.send(this._socket).then((cmd) => {
        debug(`${this._identity}: sent message (${cmd}), seq (${this._sequenceOut})`);
      });
    }
  }

  /**
   * Updates the data of this ZyrePeer, manages timeouts for evasive and expired
   *
   * @param {Object} options - Options Object
   * @param {number} [options.sequence] - Sequence of the last received message
   * @param {string} [options.address] - IP of the peer
   * @param {number} [options.mailbox] - Network port of the peer
   * @param {string} [options.endpoint] - TCP address of the peer
   * @param {number} [options.status] - Group status of the peer
   * @param {string} [options.name] - Name of the peer
   * @param {Object} [options.headers] - Headers of the peer
   * @return {ZyrePeer} This ZyrePeer
   */
  update({ sequence, address, mailbox, endpoint, status, name, headers }) {
    // Handle wrong sequence number
    if (sequence) {
      if (sequence !== (this._sequenceIn + 1) % 65536) {
        debug(`${this._identity}: wrong sequence (${sequence}), expected (${(this._sequenceIn + 1) % 65536})`);
        this.emit('expired');
        return undefined;
      }

      this._sequenceIn = sequence;
    }

    if (address && mailbox) {
      this._endpoint = `tcp://${address}:${mailbox}`;
    } else if (endpoint) {
      this._endpoint = endpoint;
    }

    if (status) this._status = status;
    if (name) this._name = name;
    if (headers) this._headers = headers;

    if (this._evasiveAt > 0) {
      this._evasiveAt = 0;
      debug(`${this._identity}: back from being evasive`);
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
      this.emit('evasive');

      this.send(new ZreMsg(ZreMsg.PING));
    }, PEER_EVASIVE);

    this._expiredTimeout = setTimeout(() => {
      debug(`${this._identity}: expired at ${Date.now()}`);
      this.emit('expired');
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

module.exports = ZyrePeer;
