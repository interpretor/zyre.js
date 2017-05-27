/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const ZreMsg = require('./zre_msg');

/**
 * ZyreGroup represents a group of ZyrePeers
 */
class ZyreGroup {

  /**
   * @param {string} name - Name of the group
   */
  constructor(name) {
    this._name = name;
    this._peers = {};
  }

  /**
   * Adds a new ZyrePeer to the group
   *
   * @param {ZyrePeer} zyrePeer - ZyrePeer to add
   */
  push(zyrePeer) {
    this._peers[zyrePeer.getIdentity()] = zyrePeer;
  }

  /**
   * Removes an existing ZyrePeer from the group
   *
   * @param {string} identity - Identity of the ZyrePeer to be removed
   */
  pop(identity) {
    delete this._peers[identity];
  }

  /**
   * Sends a message to all group members
   *
   * @param {ZreMsg} msg - ZreMsg to send
   */
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

  /**
   * Creates an object with public data of the peers in this group
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
}

module.exports = ZyreGroup;
