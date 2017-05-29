/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

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
   * @return {string} Name of the group
   */
  getName() {
    return this._name;
  }

  /**
   * Adds a new ZyrePeer to the group
   *
   * @param {ZyrePeer} zyrePeer - ZyrePeer
   */
  add(zyrePeer) {
    if (!this._peers[zyrePeer.getIdentity()]) {
      this._peers[zyrePeer.getIdentity()] = zyrePeer;
      zyrePeer.addToGroup(this);
    }
  }

  /**
   * Removes an existing ZyrePeer from the group
   *
   * @param {ZyrePeer} zyrePeer - ZyrePeer
   */
  remove(zyrePeer) {
    if (this._peers[zyrePeer.getIdentity()]) {
      delete this._peers[zyrePeer.getIdentity()];
      zyrePeer.removeFromGroup(this);
    }
  }

  /**
   * Sends a message to all group members
   *
   * @param {ZreMsg} msg - ZreMsg
   */
  send(msg) {
    msg.setGroup(this._name);
    for (const i in this._peers) {
      if ({}.hasOwnProperty.call(this._peers, i)) {
        this._peers[i].send(msg);
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
