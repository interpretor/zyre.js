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
   * @param {ZyreGroups} options.zyreGroups - Global ZyreGroups object
   */
  constructor({ identity, name, address, mailbox, headers = {}, zyrePeers, zyreGroups }) {
    super();

    this._identity = identity;
    this._name = name;
    this._endpoint = `tcp://${address}:${mailbox}`;
    this._headers = headers;
    this._zyrePeers = zyrePeers;
    this._zyreGroups = zyreGroups;
    this._groups = [];
    this._status = 0;

    // Connect to new peers
    this._zyrePeers.on('new', (zyrePeer) => {
      zyrePeer.connect();
      zyrePeer.send(new ZreMsg(ZreMsg.HELLO, {
        endpoint: this._endpoint,
        groups: this._groups,
        status: this._status,
        name: this._name,
        headers: this._headers,
      }));
    });
  }

  /**
   * Starts listening for foreign messages, manages incoming messages as defined in ZRE
   *
   * @return {Promise}
   */
  startListening() {
    this._socket = zeromq.socket('router');

    this._socket.on('message', (id, msg, frame) => {
      const zreMsg = ZreMsg.read(msg, frame);
      if (!zreMsg) {
        debug('malformed message');
        return;
      }

      const identity = id.slice(1).toString('hex');

      // Unknown peer handling
      if (!this._zyrePeers.getPeer(identity)) {
        // If unknown peer and no HELLO message
        if (zreMsg.getCmd() !== ZreMsg.HELLO) {
          debug(`${identity}: unknown peer wants to send (${zreMsg.getCmd()})`);
          return;
        }
      // Reset peer if another HELLO message incoming from known peer
      } else if (
        zreMsg.getCmd() === ZreMsg.HELLO &&
        this._zyrePeers.getPeer(identity).getSequence() > 0
      ) {
        this._zyrePeers.remove(identity);
      }

      debug(`${identity}: received message (${zreMsg.getCmd()}), seq (${zreMsg.getSequence()})`);

      const zyrePeer = this._zyrePeers.push({
        identity,
        sequence: zreMsg.getSequence(),
        endpoint: zreMsg.getEndpoint(),
        status: zreMsg.getStatus(),
        name: zreMsg.getName(),
        headers: zreMsg.getHeaders(),
      });

      // If an error occured in updating the peer, prevent further event handling
      if (!zyrePeer) return;

      // Message handling
      switch (zreMsg.getCmd()) {
        case ZreMsg.HELLO:
          zreMsg.getGroups().forEach((e) => {
            this._zyreGroups.push(e, zyrePeer);
          });
          break;

        case ZreMsg.WHISPER:
          this.emit('message', zyrePeer.getName(), zreMsg.getContent());
          break;

        case ZreMsg.SHOUT:
          if (this._groups.includes(zreMsg.getGroup())) {
            this.emit('message', zyrePeer.getName(), zreMsg.getContent(), zreMsg.getGroup());
          }
          break;

        case ZreMsg.JOIN:
          this._zyreGroups.push(zreMsg.getGroup(), zyrePeer);
          break;

        case ZreMsg.LEAVE:
          this._zyreGroups.remove(zreMsg.getGroup(), zyrePeer);
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
   * Stops listening for messages and closes the socket
   *
   * @return {Promise}
   */
  stopListening() {
    this._socket.removeAllListeners();

    return new Promise((resolve) => {
      this._socket.unbind(this._endpoint, () => {
        this._socket.close();
        resolve();
      });
    });
  }

  /**
   * Joins a group
   *
   * @param {string} group - Name of the group
   */
  join(group) {
    this._groups.push(group);
    this._status = (this._status + 1) % 256;
    this._zyrePeers.send(new ZreMsg(ZreMsg.JOIN, {
      group,
      status: this._status,
    }));
  }

  /**
   * Leaves a group
   *
   * @param {string} group - Name of the group
   */
  leave(group) {
    const newGroups = [];
    this._groups.forEach((e) => {
      if (e !== group) newGroups.push(e);
    });

    this._groups = newGroups;
    this._status = (this._status + 1) % 256;
    this._zyrePeers.send(new ZreMsg(ZreMsg.LEAVE, {
      group,
      status: this._status,
    }));
  }
}

module.exports = ZyreNode;
