/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const ZyreGroup = require('./zyre_group');

/**
 * ZyreGroups manages all ZyreGroup objects
 */
class ZyreGroups {

  constructor() {
    this._groups = {};
  }

  /**
   * Returns a ZyreGroup with the given name
   *
   * @param {string} name - Name of the group
   * @return {ZyreGroup}
   */
  getGroup(name) {
    return this._groups[name];
  }

  /**
   * Adds a new ZyrePeer to the ZyreGroup with the given name, creates a new ZyreGroup if a group
   * with the given name doesn't exist yet
   *
   * @param {string} name - Name of the group
   * @param {ZyrePeer} zyrePeer - ZyrePeer
   */
  push(name, zyrePeer) {
    if (!this._groups[name]) {
      const zyreGroup = new ZyreGroup(name);
      this._groups[name] = zyreGroup;
    }

    this._groups[name].add(zyrePeer);
  }

  /**
   * Removes a ZyrePeer from an existing ZyreGroup
   *
   * @param {string} name - Name of the group
   * @param {ZyrePeer} zyrePeer - ZyrePeer
   */
  remove(name, zyrePeer) {
    if (this._groups[name]) {
      this._groups[name].remove(zyrePeer);
    }
  }

  /**
   * @typedef {Object} GroupsObject
   * @property {PeersObject}
   */

  /**
   * Creates an object with public data of all groups
   *
   * @return {GroupsObject}
   */
  toObj() {
    const obj = {};
    for (const i in this._groups) {
      if ({}.hasOwnProperty.call(this._groups, i)) {
        obj[i] = this._groups[i].toObj();
      }
    }

    return obj;
  }
}

module.exports = ZyreGroups;
