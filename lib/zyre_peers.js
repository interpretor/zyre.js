/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const EventEmitter = require('events');
const ZyrePeer = require('./zyre_peer');

module.exports = class ZyrePeers extends EventEmitter {

  constructor(identity) {
    super();

    this._identity = identity;
    this._peers = {};
  }

  getPeer(identity) {
    return this._peers[identity];
  }

  push({ identity, sequence, address, mailbox, endpoint, status, name, headers }) {
    if (this._peers[identity]) {
      this._peers[identity].update({ sequence, address, mailbox, endpoint, status, name, headers });
    } else {
      const zyrePeer = new ZyrePeer({
        identity,
        sequence,
        address,
        mailbox,
        endpoint,
        status,
        name,
        headers,
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
      this.emit('new', zyrePeer);
    }
  }

  send(msg) {
    for (const i in this._peers) {
      if ({}.hasOwnProperty.call(this._peers, i)) {
        this._peers[i].send(msg);
      }
    }
  }
};
