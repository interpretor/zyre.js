/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const EventEmitter = require('events');
const uuid = require('uuid');
const ZHelper = require('./zhelper');
const ZyrePeers = require('./zyre_peers');
const ZyreNode = require('./zyre_node');
const ZBeacon = require('./zbeacon');

const MAILBOX = 49152;

module.exports = class Zyre extends EventEmitter {

  constructor({ name, iface }) {
    super();

    if (iface) {
      this._ifaceData = ZHelper.getIfData(iface);
    } else {
      this._ifaceData = ZHelper.getIfData();
    }

    if (!this._ifaceData) {
      throw new Error('Could not find IPv4 broadcast interface data');
    }

    // Create new uuid
    this._identity = Buffer.alloc(16);
    uuid.v4(null, this._identity, 0);

    // Set the name to the first six bytes of the uuid if name is not given
    if (name) {
      this._name = name;
    } else {
      this._name = this._identity.toString('hex', 0, 6);
    }

    this._zyrePeers = new ZyrePeers(this._identity);
  }

  start(callback) {
    return new Promise((resolve) => {
      ZHelper.getFreePort(this._ifaceData.address, MAILBOX).then((port) => {
        this._zyreNode = new ZyreNode({
          identity: this._identity,
          name: this._name,
          address: this._ifaceData.address,
          mailbox: port,
          zyrePeers: this._zyrePeers,
        });

        this._zyreNode.on('message', (name, message, group) => {
          this.emit('message', name, message, group);
        });

        this._zBeacon = new ZBeacon({
          identity: this._identity,
          address: this._ifaceData.broadcast,
          mailbox: port,
          zyrePeers: this._zyrePeers,
        });

        this._zyreNode.startListening().then(() => {
          this._zBeacon.start().then(() => {
            if (callback) callback();
            resolve();
          });
        });
      });
    });
  }

  whisper(identity, message) {
    this._zyreNode.whisper(identity, message);
  }

  shout(group, message) {
    this._zyreNode.shout(group, message);
  }

  join(group) {
    this._zyreNode.join(group);
  }

  leave(group) {
    this._zyreNode.leave(group);
  }

  static new({ name, iface } = {}) {
    return new Zyre({ name, iface });
  }
};
