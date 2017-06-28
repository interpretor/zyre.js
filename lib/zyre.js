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
 * Zyre represents the public api.
 *
 * @extends EventEmitter
 */
class Zyre extends EventEmitter {

  /**
   * @param {object} options - Options object
   * @param {string} [options.name] - Name of the zyre node
   * @param {string} [options.iface] - Network interface to use
   * @param {object} [options.headers] - Optional headers, sent to every peer on discovery
   * @param {number} [options.evasive] - Evasive timeout in ms
   * @param {number} [options.expired] - Expired timeout in ms
   * @param {number} [options.bport] - Broadcast beacon port
   * @param {number} [options.binterval] - Broadcast beacon interval in ms
   */
  constructor({ name, iface, headers, evasive, expired, bport, binterval } = {}) {
    super();

    if (typeof iface === 'string') {
      this._ifaceData = ZHelper.getIfData(iface);
    } else {
      this._ifaceData = ZHelper.getIfData();
    }

    if (typeof this._ifaceData === 'undefined') {
      throw new Error('Could not find IPv4 broadcast interface data');
    }

    // Create new uuid
    this._identity = Buffer.alloc(16);
    uuid.v4(null, this._identity, 0);

    // Set the name to the first six bytes of the uuid if name is not given
    if (typeof name === 'string') {
      this._name = name;
    } else {
      this._name = this._identity.toString('hex', 0, 6);
    }

    if (typeof headers === 'object' && headers !== null) this._headers = headers;
    if (typeof evasive === 'number') this._evasive = evasive;
    if (typeof expired === 'number') this._expired = expired;
    if (typeof bport === 'number') this._bport = bport;
    if (typeof binterval === 'number') this._binterval = binterval;

    this._createHandler();
  }

  /**
   * Finds a free TCP port on the host, starts the ZyreNode and the ZBeacon, adds listeners.
   * Executes the callback or returns a Promise on success.
   *
   * @fires Zyre#connect
   * @fires Zyre#disconnect
   * @fires Zyre#expired
   * @fires Zyre#whisper
   * @fires Zyre#shout
   * @fires Zyre#join
   * @fires Zyre#leave
   * @param {function} callback - Executed on success
   * @return {Promise}
   */
  start(callback) {
    // Initialize groups
    this._zyreGroups = new ZyreGroups();

    // Initialize peers
    this._zyrePeers = new ZyrePeers({
      identity: this._identity,
      evasive: this._evasive,
      expired: this._expired,
    });

    this._zyrePeers.on('expired', this._expiredHandler);
    this._zyrePeers.on('disconnect', this._disconnectHandler);

    return new Promise((resolve) => {
      // Initialize node and beacon when the mailbox port is found
      ZHelper.getFreePort(this._ifaceData.address, MAILBOX).then((mailbox) => {
        this._zyreNode = new ZyreNode({
          identity: this._identity,
          name: this._name,
          address: this._ifaceData.address,
          mailbox,
          headers: this._headers,
          zyrePeers: this._zyrePeers,
          zyreGroups: this._zyreGroups,
        });

        this._zyreNode.on('hello', this._connectHandler);
        this._zyreNode.on('whisper', this._whisperHandler);
        this._zyreNode.on('shout', this._shoutHandler);
        this._zyreNode.on('join', this._joinHandler);
        this._zyreNode.on('leave', this._leaveHandler);

        this._zBeacon = new ZBeacon({
          identity: this._identity,
          mailbox,
          ifaceData: this._ifaceData,
          port: this._bport,
          interval: this._binterval,
          zyrePeers: this._zyrePeers,
        });

        // Start node and beacon
        this._zyreNode.startListening().then(() => {
          this._zBeacon.start().then(() => {
            if (typeof callback === 'function') callback();
            resolve();
          });
        });
      });
    });
  }

  /**
   * Stops listening, closes all sockets, removes all event listeners and disconnects from all
   * peers. Executes the callback or returns a Promise on success.
   *
   * @param {function} callback - Executed on success
   * @return {Promise}
   */
  stop(callback) {
    return new Promise((resolve) => {
      this._zyreNode.removeAllListeners();
      this._zyrePeers.removeAllListeners();
      this._zyrePeers.disconnectAll();
      this._zBeacon.stop().then(() => {
        this._zyreNode.stopListening().then(() => {
          if (typeof callback === 'function') callback();
          resolve();
        });
      });
    });
  }

  /**
   * Sends a message to a ZyrePeer.
   *
   * @param {string} identity - Identity of the peer
   * @param {string} message - Message to send
   */
  whisper(identity, message) {
    if (this._zyrePeers.exists(identity)) {
      this._zyrePeers.getPeer(identity).send(new ZreMsg(ZreMsg.WHISPER, {
        content: message,
      }));
    }
  }

  /**
   * Sends a message to a ZyreGroup.
   *
   * @param {string} group - Name of the group
   * @param {string} message - Message to send
   */
  shout(group, message) {
    if (this._zyreGroups.exists(group)) {
      this._zyreGroups.getGroup(group).send(new ZreMsg(ZreMsg.SHOUT, {
        group,
        content: message,
      }));
    }
  }

  /**
   * Joins a group.
   *
   * @param {string} group - Name of the group
   */
  join(group) {
    this._zyreNode.join(group);
  }

  /**
   * Leaves a group.
   *
   * @param {string} group - Name of the group
   */
  leave(group) {
    this._zyreNode.leave(group);
  }

  /**
   * @return {string} Identity
   */
  getIdentity() {
    return this._identity.toString('hex');
  }

  /**
   * Returns an object with information of the ZyrePeer with the given identity.
   *
   * @param {string} identity - Identity of the peer
   * @return {PeerObject}
   */
  getPeer(identity) {
    if (this._zyrePeers.exists(identity)) return this._zyrePeers.getPeer(identity).toObj();
    return undefined;
  }

  /**
   * Returns an object with information of all ZyrePeers.
   *
   * @return {PeersObject}
   */
  getPeers() {
    return this._zyrePeers.toObj();
  }

  /**
   * Returns an object with information of the ZyreGroup with the given name.
   *
   * @param {string} name - Name of the group
   * @return {PeersObject}
   */
  getGroup(name) {
    if (this._zyreGroups.exists(name)) return this._zyreGroups.getGroup(name).toObj();
    return undefined;
  }

  /**
   * Returns an object with information of all ZyreGroups.
   *
   * @return {GroupsObject}
   */
  getGroups() {
    return this._zyreGroups.toObj();
  }

  /**
   * Creates handler as object properties in a separate method to ensure proper scope via arrow
   * functions.
   *
   * @protected
   */
  _createHandler() {
    this._connectHandler = (peer) => {
      /**
       * @event Zyre#connect
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       * @property {object} headers - Headers of the peer
       */
      this.emit('connect', peer.getIdentity(), peer.getName(), peer.getHeaders());
    };

    this._disconnectHandler = (peer) => {
      /**
       * @event Zyre#disconnect
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       */
      this.emit('disconnect', peer.getIdentity(), peer.getName());
    };

    this._expiredHandler = (peer) => {
      /**
       * @event Zyre#expired
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       */
      this.emit('expired', peer.getIdentity(), peer.getName());
    };

    this._whisperHandler = (peer, message) => {
      /**
       * @event Zyre#whisper
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       * @property {string} message - Message
       */
      this.emit('whisper', peer.getIdentity(), peer.getName(), message);
    };

    this._shoutHandler = (peer, message, group) => {
      /**
       * @event Zyre#shout
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       * @property {string} message - Message
       * @property {string} group - Group where the message came from
       */
      this.emit('shout', peer.getIdentity(), peer.getName(), message, group);
    };

    this._joinHandler = (peer, group) => {
      /**
       * @event Zyre#join
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       * @property {string} group - Group which the peer joins
       */
      this.emit('join', peer.getIdentity(), peer.getName(), group);
    };

    this._leaveHandler = (peer, group) => {
      /**
       * @event Zyre#leave
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       * @property {string} group - Group which the peer leaves
       */
      this.emit('leave', peer.getIdentity(), peer.getName(), group);
    };
  }

  /**
   * Returns a new Zyre instance.
   *
   * @param {object} options - Options object
   * @param {string} [options.name] - Name of the zyre node
   * @param {string} [options.iface] - Network interface to use
   * @param {object} [options.headers] - Optional headers, sent to every peer on discovery
   * @param {number} [options.evasive] - Evasive timeout in ms
   * @param {number} [options.expired] - Expired timeout in ms
   * @param {number} [options.bport] - Broadcast beacon port
   * @param {number} [options.binterval] - Broadcast beacon interval in ms
   * @return {Zyre}
   */
  static new({ name, iface, headers, evasive, expired, bport, binterval } = {}) {
    return new Zyre({ name, iface, headers, evasive, expired, bport, binterval });
  }
}

module.exports = Zyre;
