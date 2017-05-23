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
const PEER_EXPIRED = 30000;

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
    this._expiredAt = 0;
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
      this._sequenceOut += 1;
      msg.setSequence(this._sequenceOut);
      msg.send(this._socket).then((cmd) => {
        debug(`${this._identity}: sent message (${cmd})`);
      });
    }
  }

  /**
   * Updates the data of this ZyrePeer, manages timeouts for being evasive and expired
   *
   * @param {Object} options - Options Object
   * @param {number} [options.sequence] - Sequence of the last received message
   * @param {string} [options.address] - IP of the peer
   * @param {number} [options.mailbox] - Network port of the peer
   * @param {string} [options.endpoint] - TCP address of the peer
   * @param {number} [options.status] - Group status of the peer
   * @param {string} [options.name] - Name of the peer
   * @param {Object} [options.headers] - Headers of the peer
   */
  update({ sequence, address, mailbox, endpoint, status, name, headers }) {
    if (sequence) {
      // Handle wrong sequence number
      if (sequence !== this._sequenceIn + 1) {
        debug(`${this._identity}: wrong sequence (${sequence}), expected: (${this._sequenceIn + 1})`);
        if (this._connected) this.disconnect();
        clearTimeout(this._evasiveTimeout);
        clearTimeout(this._expiredTimeout);
        this.emit('expired');
        return;
      }
      this._sequenceIn = sequence;
    }

    if (endpoint) {
      this._endpoint = endpoint;
    } else if (address && mailbox) {
      this._endpoint = `tcp://${address}:${mailbox}`;
    }

    if (status) this._status = status;
    if (name) this._name = name;
    if (headers) this._headers = headers;

    // Handle timeouts
    clearTimeout(this._evasiveTimeout);
    clearTimeout(this._expiredTimeout);
    if (this._evasiveAt > 0) {
      this._evasiveAt = 0;
      debug(`${this._identity}: back from being evasive`);
    }

    this._evasiveTimeout = setTimeout(() => {
      this._evasiveAt = Date.now();
      debug(`${this._identity}: evasive at ${this._evasiveAt}`);
      this.emit('evasive');
    }, PEER_EVASIVE);

    this._expiredTimeout = setTimeout(() => {
      this._expiredAt = Date.now();
      debug(`${this._identity}: expired at ${this._expiredAt}`);
      if (this._connected) this.disconnect();
      this.emit('expired');
    }, PEER_EXPIRED);
  }
}

module.exports = ZyrePeer;
