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
const PING_INTERVAL = 1000;

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
   * @return {string} - Name of the peer
   */
  getName() {
    return this._name;
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
   * Disconnects from this ZyrePeer
   */
  disconnect() {
    this._clearTimeouts();
    if (this._connected) {
      this._socket.close();
      this._connected = false;
      debug(`${this._identity}: disconnected`);
    }
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
   * Resets the sequence numbers of the ZyrePeer, should be called if the already known peer
   * receives a HELLO message
   */
  resetSequence() {
    this._sequenceIn = 0;
    this._sequenceOut = 1;
  }

  /**
   * Updates the data of this ZyrePeer, manages timeouts for evasive, expired and ping
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
        this.disconnect();
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
   * Sets timeouts for evasive, expired and ping
   *
   * @protected
   */
  _setTimeouts() {
    this._evasiveTimeout = setTimeout(() => {
      this._evasiveAt = Date.now();
      debug(`${this._identity}: evasive at ${this._evasiveAt}`);
      this.emit('evasive');

      this._pingInterval = setInterval(() => {
        this.send(new ZreMsg(ZreMsg.PING));
      }, PING_INTERVAL);
    }, PEER_EVASIVE);

    this._expiredTimeout = setTimeout(() => {
      debug(`${this._identity}: expired at ${Date.now()}`);
      this.disconnect();
      this.emit('expired');
    }, PEER_EXPIRED);
  }

  /**
   * Clears the evasive, expired and ping timeouts
   *
   * @protected
   */
  _clearTimeouts() {
    clearTimeout(this._evasiveTimeout);
    clearTimeout(this._expiredTimeout);
    clearInterval(this._pingInterval);
  }

  /**
   * @typedef {Object} PeerObject
   * @property {string} name
   * @property {string} endpoint
   * @property {Object} headers
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
    return obj;
  }
}

module.exports = ZyrePeer;
