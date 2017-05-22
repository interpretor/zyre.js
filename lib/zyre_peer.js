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

module.exports = class ZyrePeer extends EventEmitter {

  /**
   * Every ZyrePeer instance holds one unique peer found by either a received udp beacon or a
   * received message
   *
   * @constructor
   * @param {string} identity
   * @param {Buffer} originID
   * @param {number} [sequence]
   * @param {string} [address]
   * @param {number} [mailbox]
   * @param {string} [endpoint]
   * @param {number} [status]
   * @param {string} [name]
   * @param {Object} [headers]
   */
  constructor({ identity, originID, sequence, address, mailbox, endpoint, status, name, headers }) {
    super();

    this._identity = identity;
    this._originID = originID;
    this._sequenceIn = 0;
    this._sequenceOut = 0;
    this.update({ sequence, address, mailbox, endpoint, status, name, headers });
    this._connected = false;
    this._evasiveAt = 0;
    this._expiredAt = 0;
  }

  getIdentity() {
    return this._identity;
  }

  getName() {
    return this._name;
  }

  connect() {
    this._socket = zeromq.socket('dealer', {
      identity: Buffer.concat([Buffer.from([ID_PREFIX]), this._originID]),
    });

    this._socket.connect(this._endpoint);
    this._connected = true;
    debug(`${this._identity}: connected`);
  }

  disconnect() {
    if (this._connected) {
      this._socket.close();
      this._connected = false;
      debug(`${this._identity}: disconnected`);
    }
  }

  send(msg) {
    if (this._connected && msg instanceof ZreMsg) {
      this._sequenceOut += 1;
      msg.setSequence(this._sequenceOut);
      msg.send(this._socket).then((cmd) => {
        debug(`${this._identity}: sent message (${cmd})`);
      });
    }
  }

  update({ sequence, address, mailbox, endpoint, status, name, headers }) {
    if (sequence) {
      // Handle wrong sequence number
      if (sequence !== this._sequenceIn + 1) {
        debug(`${this._identity}: wrong sequence (${sequence}), expected: (${this._sequenceIn + 1})`);
        this.disconnect();
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
      this.disconnect();
      this.emit('expired');
    }, PEER_EXPIRED);
  }
};
