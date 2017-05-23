/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const EventEmitter = require('events');
const debug = require('debug')('zyre:zyre_node');
const zeromq = require('zeromq');
const ZreMsg = require('./zre_msg');
const ZyreGroups = require('./zyre_groups');

/**
 * ZyreNode represents a local zyre node, which handles messaging with other zyre peers
 *
 * @extends EventEmitter
 */
class ZyreNode extends EventEmitter {

  /**
   * @param {Object} options - Options Object
   * @param {Buffer} options.identity - 16 byte UUID as Buffer
   * @param {string} options.name - Name of the zyre node
   * @param {string} options.address - Address of the zyre node
   * @param {number} options.mailbox - Network port of the zyre node
   * @param {Object} [options.headers={}] - Headers of the zyre node
   * @param {ZyrePeers} options.zyrePeers - Global ZyrePeers object
   */
  constructor({ identity, name, address, mailbox, headers = {}, zyrePeers }) {
    super();

    this._identity = identity;
    this._name = name;
    this._endpoint = `tcp://${address}:${mailbox}`;
    this._headers = headers;
    this._zyrePeers = zyrePeers;
    this._groups = [];
    this._status = 0;
    this._zyreGroups = new ZyreGroups();

    // New peer handling
    this._zyrePeers.on('new', (zyrePeer) => {
      zyrePeer.connect();
      zyrePeer.send(new ZreMsg(ZreMsg.HELLO, {
        endpoint: this._endpoint,
        groups: this._groups,
        status: this._status,
        name: this._name,
        headers: this._headers,
      }));

      this.emit('new', zyrePeer.getName());
    });
  }

  /**
   * Starts listening for foreign messages, manages new peers and incoming messages as defined in
   * ZRE
   *
   * @return {Promise}
   */
  startListening() {
    this._socket = zeromq.socket('router');

    // Message handling
    this._socket.on('message', (id, msg, frame) => {
      const zreMsg = ZreMsg.read(msg, frame);
      if (!zreMsg) {
        debug('malformed message');
        return;
      }

      const identity = id.slice(1).toString('hex');

      debug(`${identity}: received message (${zreMsg.getCmd()})`);

      // If an unknown peer wants to send messages other than HELLO
      if (!this._zyrePeers.getPeer(identity) && zreMsg.getCmd() !== ZreMsg.HELLO) {
        debug(`${identity}: unknown peer wants to send (${zreMsg.getCmd()})`);
        return;
      }

      const zyrePeer = this._zyrePeers.push({
        identity,
        sequence: zreMsg.getSequence(),
        endpoint: zreMsg.getEndpoint(),
        status: zreMsg.getStatus(),
        name: zreMsg.getName(),
        headers: zreMsg.getHeaders(),
      });

      switch (zreMsg.getCmd()) {
        case ZreMsg.HELLO:
          zreMsg.getGroups().forEach((e) => {
            this._zyreGroups.push(e, zyrePeer);
          });
          break;

        case ZreMsg.WHISPER:
        case ZreMsg.SHOUT:
          this.emit('message', zyrePeer.getName(), zreMsg.getContent(), zreMsg.getGroup());
          break;

        case ZreMsg.JOIN:
          this._zyreGroups.push(zreMsg.getGroup(), zyrePeer);
          break;

        case ZreMsg.LEAVE:
          this._zyreGroups.pop(zreMsg.getGroup(), identity);
          break;

        case ZreMsg.PING:
          zyrePeer.send(new ZreMsg(ZreMsg.PING_OK));
          break;

        default:
      }
    });

    return new Promise((resolve) => {
      this._socket.bind(this._endpoint, () => {
        debug(`listening on ${this._endpoint}`);
        resolve();
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
   * Joins a ZyreGroup
   *
   * @param {string} group - Name of the group
   */
  join(group) {
    this._groups.push(group);
    this._status += 1;
    this._zyrePeers.send(new ZreMsg(ZreMsg.JOIN, {
      group,
      status: this._status,
    }));
  }

  /**
   * Leaves a ZyreGroup
   *
   * @param {string} group - Name of the group
   */
  leave(group) {
    this._groups.pop(group);
    this._status += 1;
    this._zyrePeers.send(new ZreMsg(ZreMsg.LEAVE, {
      group,
      status: this._status,
    }));
  }
}

module.exports = ZyreNode;
