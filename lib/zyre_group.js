/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * ZyreGroup represents a group of ZyrePeers.
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
   * @return {number} Amount of participating peers
   */
  amountOfPeers() {
    return Object.getOwnPropertyNames(this._peers).length;
  }

  /**
   * Adds a new ZyrePeer to the group.
   *
   * @param {ZyrePeer} zyrePeer - ZyrePeer
   */
  add(zyrePeer) {
    if (typeof this._peers[zyrePeer.getIdentity()] === 'undefined') {
      this._peers[zyrePeer.getIdentity()] = zyrePeer;
      zyrePeer.addToGroup(this);
    }
  }

  /**
   * Removes an existing ZyrePeer from the group.
   *
   * @param {ZyrePeer} zyrePeer - ZyrePeer
   */
  remove(zyrePeer) {
    if (typeof this._peers[zyrePeer.getIdentity()] !== 'undefined') {
      delete this._peers[zyrePeer.getIdentity()];
      zyrePeer.removeFromGroup(this);
    }
  }

  /**
   * Sends a message to all group members.
   *
   * @param {ZreMsg} msg - ZreMsg
   */
  send(msg) {
    msg.setGroup(this._name);

    Object.keys(this._peers).forEach((i) => {
      this._peers[i].send(msg);
    });
  }

  /**
   * Creates an object with public data of the peers in this group.
   *
   * @return {PeersObject}
   */
  toObj() {
    const obj = {};

    Object.keys(this._peers).forEach((i) => {
      obj[i] = this._peers[i].toObj();
    });

    return obj;
  }
}

module.exports = ZyreGroup;
