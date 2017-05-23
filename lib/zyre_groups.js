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
   * Returns a ZyreGroup from the given name
   *
   * @param {string} name - Name of the ZyreGroup
   * @return {ZyreGroup}
   */
  getGroup(name) {
    return this._groups[name];
  }

  /**
   * Adds a new ZyrePeer to the ZyreGroup from the given name, creates a new ZyreGroup if a group
   * with the given name does not exist
   *
   * @param {string} name - Name of the group
   * @param {ZyrePeer} zyrePeer - ZyrePeer to add
   */
  push(name, zyrePeer) {
    // If new group
    if (!this._groups[name]) {
      const zyreGroup = new ZyreGroup(name);
      this._groups[name] = zyreGroup;
    }
    this._groups[name].push(zyrePeer);
  }

  /**
   * Removes a ZyrePeer from an existing ZyreGroup
   *
   * @param {string} name - Name of the group
   * @param {string} identity - Identity of the ZyrePeer to be removed
   */
  pop(name, identity) {
    if (this._groups[name]) {
      this._groups[name].pop(identity);
    }
  }
}

module.exports = ZyreGroups;
