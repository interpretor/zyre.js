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

/**
 * Zyre represents the public api.
 *
 * @extends EventEmitter
 */
class Zyre extends EventEmitter {
  /**
   * @param {object} options - Options object
   * @param {string} [options.name] - Name of the zyre node
   * @param {string} [options.iface] - Network interface or IPv4 address
   * @param {object} [options.headers] - Optional headers, sent to every peer on discovery
   * @param {number} [options.evasive=5000] - Evasive timeout in ms
   * @param {number} [options.expired=30000] - Expired timeout in ms
   * @param {number} [options.port=49152] - Port for incoming messages, will be incremented if used
   * @param {number} [options.bport=5670] - Broadcast beacon port
   * @param {number} [options.binterval=1000] - Broadcast beacon interval in ms
   */
  constructor({
    name,
    iface,
    headers,
    evasive = 5000,
    expired = 30000,
    port = 49152,
    bport = 5670,
    binterval = 1000,
  } = {}) {
    super();

    if (typeof iface === 'string') {
      this._ifaceData = ZHelper.getIfData(iface);
    } else {
      this._ifaceData = ZHelper.getIfData();
    }

    if (typeof this._ifaceData === 'undefined') {
      throw new Error('Could not find a valid IPv4 interface with given parameters');
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
    if (typeof port === 'number') this._port = port;
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
      ZHelper.getFreePort(this._ifaceData.address, this._port).then((mailbox) => {
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
    this._zyreNode.removeAllListeners();
    this._zyrePeers.removeAllListeners();
    this._zyrePeers.disconnectAll();

    return new Promise((resolve) => {
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
   * @param {(string|Buffer)} message - Message to send
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
   * @param {(string|Buffer)} message - Message to send
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
   * Sets the encoding of received messages. Defaults to utf8.
   *
   * @param {?string} encoding - Encoding of messages
   */
  setEncoding(encoding) {
    switch (encoding) {
      case 'ascii':
      case 'utf8':
      case 'utf16le':
      case 'ucs2':
      case 'base64':
      case 'binary':
      case 'hex':
        this._encoding = encoding;
        break;

      case 'raw':
      case null:
        this._encoding = 'raw';
        break;

      default:
        this._encoding = 'utf8';
    }
  }

  /**
   * Returns the encoded content of the ZreMsg. Encoding is set by setEncoding(encoding).
   *
   * @protected
   * @param {Buffer} content - Content of a ZreMsg
   * @return {(string|Buffer)}
   */
  _getEncodedContent(content) {
    if (typeof this._encoding === 'undefined') return content.toString('utf8');
    if (this._encoding === 'raw') return content;
    return content.toString(this._encoding);
  }

  /**
   * Creates handler as object properties in a separate method to ensure proper scope via arrow
   * functions.
   *
   * @protected
   */
  _createHandler() {
    this._connectHandler = (zyrePeer) => {
      /**
       * @event Zyre#connect
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       * @property {object} headers - Headers of the peer
       */
      this.emit('connect', zyrePeer.identity, zyrePeer.name, zyrePeer.headers);
    };

    this._disconnectHandler = (zyrePeer) => {
      /**
       * @event Zyre#disconnect
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       */
      this.emit('disconnect', zyrePeer.identity, zyrePeer.name);
    };

    this._expiredHandler = (zyrePeer) => {
      /**
       * @event Zyre#expired
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       */
      this.emit('expired', zyrePeer.identity, zyrePeer.name);
    };

    this._whisperHandler = (zyrePeer, content) => {
      const encodedContent = this._getEncodedContent(content);
      /**
       * @event Zyre#whisper
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       * @property {(string|Buffer)} message - Message
       */
      this.emit('whisper', zyrePeer.identity, zyrePeer.name, encodedContent);
    };

    this._shoutHandler = (zyrePeer, content, group) => {
      const encodedContent = this._getEncodedContent(content);
      /**
       * @event Zyre#shout
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       * @property {(string|Buffer)} message - Message
       * @property {string} group - Group where the message came from
       */
      this.emit('shout', zyrePeer.identity, zyrePeer.name, encodedContent, group);
    };

    this._joinHandler = (zyrePeer, group) => {
      /**
       * @event Zyre#join
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       * @property {string} group - Group which the peer joins
       */
      this.emit('join', zyrePeer.identity, zyrePeer.name, group);
    };

    this._leaveHandler = (zyrePeer, group) => {
      /**
       * @event Zyre#leave
       * @property {string} identity - Identity of the peer
       * @property {string} name - Name of the peer
       * @property {string} group - Group which the peer leaves
       */
      this.emit('leave', zyrePeer.identity, zyrePeer.name, group);
    };
  }

  /**
   * Returns a new Zyre instance.
   *
   * @param {object} options - Options object
   * @param {string} [options.name] - Name of the zyre node
   * @param {string} [options.iface] - Network interface to use
   * @param {object} [options.headers] - Optional headers, sent to every peer on discovery
   * @param {number} [options.evasive=5000] - Evasive timeout in ms
   * @param {number} [options.expired=30000] - Expired timeout in ms
   * @param {number} [options.port=49152] - Port for incoming messages, will be incremented if used
   * @param {number} [options.bport=5670] - Broadcast beacon port
   * @param {number} [options.binterval=1000] - Broadcast beacon interval in ms
   * @return {Zyre}
   */
  static new(...args) {
    return new Zyre(...args);
  }
}

module.exports = Zyre;
