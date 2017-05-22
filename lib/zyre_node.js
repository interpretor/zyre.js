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

module.exports = class ZyreNode extends EventEmitter {

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
  }

  startListening() {
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

    this._socket = zeromq.socket('router');

    // Message handling
    this._socket.on('message', (id, msg, frame) => {
      const zreMsg = ZreMsg.read(msg, frame);
      if (!zreMsg) {
        debug('got malformed message');
        return;
      }

      const identity = id.slice(1).toString('hex');

      debug(`${identity}: received message (${zreMsg.getCmd()})`);

      // If received HELLO message
      if (zreMsg.getCmd() === ZreMsg.HELLO) {
        this._zyrePeers.push({
          identity,
          sequence: zreMsg.getSequence(),
          endpoint: zreMsg.getEndpoint(),
          status: zreMsg.getStatus(),
          name: zreMsg.getName(),
          headers: zreMsg.getHeaders(),
        });

        zreMsg.getGroups().forEach((e) => {
          this._zyreGroups.push(e, this._zyrePeers.getPeer(identity));
        });
      // If received other than HELLO message from unknown peer, do nothing
      } else if (!this._zyrePeers.getPeer(identity)) {
        debug(`${identity}: unknown peer wants to send (${zreMsg.getCmd()})`);
      // If received message from known peer
      } else {
        this._zyrePeers.push({
          identity,
          sequence: zreMsg.getSequence(),
          status: zreMsg.getStatus(),
        });

        const zyrePeer = this._zyrePeers.getPeer(identity);

        if (zreMsg.getCmd() === ZreMsg.JOIN) {
          this._zyreGroups.push(zreMsg.getGroup(), zyrePeer);
        } else if (zreMsg.getCmd() === ZreMsg.LEAVE) {
          this._zyreGroups.pop(zreMsg.getGroup(), identity);
        }

        this.emit('message', zyrePeer.getName(), zreMsg.getContent(), zreMsg.getGroup());
      }
    });

    return new Promise((resolve) => {
      this._socket.bind(this._endpoint, () => {
        debug(`listening on ${this._endpoint}`);
        resolve();
      });
    });
  }

  whisper(identity, message) {
    if (this._zyrePeers.getPeer(identity)) {
      this._zyrePeers.getPeer(identity).send(new ZreMsg(ZreMsg.WHISPER, {
        content: message,
      }));
    }
  }

  shout(group, message) {
    if (this._zyreGroups.getGroup(group)) {
      this._zyreGroups.getGroup(group).send(new ZreMsg(ZreMsg.SHOUT, {
        group,
        content: message,
      }));
    }
  }

  join(group) {
    this._groups.push(group);
    this._status += 1;
    this._zyrePeers.send(new ZreMsg(ZreMsg.JOIN, {
      group,
      status: this._status,
    }));
  }

  leave(group) {
    this._groups.pop(group);
    this._status += 1;
    this._zyrePeers.send(new ZreMsg(ZreMsg.LEAVE, {
      group,
      status: this._status,
    }));
  }
};
