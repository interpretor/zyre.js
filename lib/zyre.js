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
const ZyreGroups = require('./zyre_groups');
const ZyreNode = require('./zyre_node');
const ZBeacon = require('./zbeacon');
const ZreMsg = require('./zre_msg');

const MAILBOX = 49152;

/**
 * Zyre represents the public api
 *
 * @extends EventEmitter
 */
class Zyre extends EventEmitter {

  /**
   * @param {Object} options - Options Object
   * @param {string} [options.name] - Name of the zyre node
   * @param {string} [options.iface] - Network interface to use
   */
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
    this._zyreGroups = new ZyreGroups();
  }

  /**
   * Finds a free tcp port on the host, starts the ZyreNode and the ZBeacon, executes the callback
   * or returns a Promise on success
   *
   * @param {function} callback - Callback to be executed on success
   * @return {Promise}
   */
  start(callback) {
    return new Promise((resolve) => {
      ZHelper.getFreePort(this._ifaceData.address, MAILBOX).then((port) => {
        this._zyreNode = new ZyreNode({
          identity: this._identity,
          name: this._name,
          address: this._ifaceData.address,
          mailbox: port,
          zyrePeers: this._zyrePeers,
          zyreGroups: this._zyreGroups,
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

  /**
   * Sends a message to a ZyrePeer
   *
   * @param {string} identity - Identity of the peer
   * @param {string} message - Message to send
   */
  whisper(identity, message) {
    if (this._zyrePeers.getPeer(identity)) {
      this._zyrePeers.getPeer(identity).send(new ZreMsg(ZreMsg.WHISPER, {
        content: message,
      }));
    }
  }

  /**
   * Sends a message to a ZyreGroup
   *
   * @param {string} group - Name of the group
   * @param {string} message - Message to send
   */
  shout(group, message) {
    if (this._zyreGroups.getGroup(group)) {
      this._zyreGroups.getGroup(group).send(new ZreMsg(ZreMsg.SHOUT, {
        group,
        content: message,
      }));
    }
  }

  /**
   * Joins a group
   *
   * @param {string} group - Name of the group
   */
  join(group) {
    this._zyreNode.join(group);
  }

  /**
   * Leaves a group
   *
   * @param {string} group - Name of the group
   */
  leave(group) {
    this._zyreNode.leave(group);
  }

  /**
   * Returns an object with information of the ZyrePeer with the given identity
   *
   * @param {string} identity - Identity of the peer
   * @return {PeerObject}
   */
  getPeer(identity) {
    return this._zyrePeers.getPeer(identity).toObj();
  }

  /**
   * Returns an object with information of all ZyrePeers
   *
   * @return {PeersObject}
   */
  getPeers() {
    return this._zyrePeers.toObj();
  }

  /**
   * Returns an object with information of the ZyreGroup with the given identity
   *
   * @param {string} name - Name of the group
   * @return {PeersObject}
   */
  getGroup(name) {
    return this._zyreGroups.getGroup(name).toObj();
  }

  /**
   * Returns an object with information of all ZyreGroups
   *
   * @return {GroupsObject}
   */
  getGroups() {
    return this._zyreGroups.toObj();
  }

  /**
   * Returns a new Zyre instance
   *
   * @param {Object} options - Options Object
   * @param {string} [options.name] - Name of the zyre node
   * @param {string} [options.iface] - Network interface to use
   * @return {Zyre} New Zyre instance
   */
  static new({ name, iface } = {}) {
    return new Zyre({ name, iface });
  }
}

module.exports = Zyre;
