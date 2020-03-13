/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-disable max-classes-per-file */

const { assert } = require('chai');
const uuid = require('uuid');
const ZyreNode = require('../lib/zyre_node');
const ZreMsg = require('../lib/zre_msg');
const ZHelper = require('../lib/zhelper');
const ZyreGroups = require('../lib/zyre_groups');

describe('ZyreNode', () => {
  let msgHit = false;

  // ZyrePeer mock
  class Peer {
    constructor() {
      this.msg = undefined;
    }

    send(msg) {
      msgHit = true;
      this.msg = msg;
      assert.instanceOf(this.msg, ZreMsg);
    }
  }

  // ZyrePeers mock
  class Peers {
    constructor() {
      this.exist = true;
      this.data = false;
    }

    exists() {
      return this.exist;
    }

    push({
      identity,
      sequence,
      endpoint,
      status,
      name,
      headers,
    }) {
      this.data = {
        identity,
        sequence,
        endpoint,
        status,
        name,
        headers,
      };
      return new Peer();
    }
  }

  it('should create an instance of ZyreNode', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyreNode = new ZyreNode({
      identity,
      name: 'foo',
      address: ZHelper.getIfData().address,
      mailbox: 54321,
      zyrePeers: new Peers(),
      zyreGroups: new ZyreGroups(),
    });

    assert.instanceOf(zyreNode, ZyreNode);
  });

  it('should send a PING_OK message when received a PING', (done) => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyreNode = new ZyreNode({
      identity,
      name: 'foo',
      address: ZHelper.getIfData().address,
      mailbox: 54321,
      zyrePeers: new Peers(),
      zyreGroups: new ZyreGroups(),
    });

    const recvID = Buffer.alloc(17);
    recvID[0] = 1;
    uuid.v4(null, recvID, 1);

    zyreNode._messageHandler(recvID, new ZreMsg(ZreMsg.PING).toBuffer());

    if (msgHit) {
      msgHit = false;
      done();
    }
  });

  it('should reject a malformed message', (done) => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeers = new Peers();

    const zyreNode = new ZyreNode({
      identity,
      name: 'foo',
      address: ZHelper.getIfData().address,
      mailbox: 54321,
      zyrePeers,
      zyreGroups: new ZyreGroups(),
    });

    const recvID = Buffer.alloc(17);
    recvID[0] = 1;
    uuid.v4(null, recvID, 1);

    zyreNode._messageHandler(recvID, 'qwertzuiop1234567890');

    if (!zyrePeers.data) {
      msgHit = false;
      done();
    }
  });

  it('should reject messages from unknown peers that are not HELLO messages', (done) => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeers = new Peers();
    zyrePeers.exist = false;

    const zyreNode = new ZyreNode({
      identity,
      name: 'foo',
      address: ZHelper.getIfData().address,
      mailbox: 54321,
      zyrePeers,
      zyreGroups: new ZyreGroups(),
    });

    const recvID = Buffer.alloc(17);
    recvID[0] = 1;
    uuid.v4(null, recvID, 1);

    zyreNode._messageHandler(recvID, new ZreMsg(ZreMsg.PING).toBuffer());

    if (!zyrePeers.data) {
      msgHit = false;
      done();
    }
  });
});
