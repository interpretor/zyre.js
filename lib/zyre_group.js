/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const ZreMsg = require('./zre_msg');

module.exports = class ZyreGroup {

  constructor(name, zyrePeer) {
    this._name = name;
    this._peers = {};
    this.push(zyrePeer);
  }

  push(zyrePeer) {
    this._peers[zyrePeer.getIdentity()] = zyrePeer;
  }

  pop(identity) {
    delete this._peers[identity];
  }

  send(msg) {
    if (msg instanceof ZreMsg) {
      msg.setGroup(this._name);
      for (const i in this._peers) {
        if ({}.hasOwnProperty.call(this._peers, i)) {
          this._peers[i].send(msg);
        }
      }
    }
  }
};
