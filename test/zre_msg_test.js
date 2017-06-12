/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const zeromq = require('zeromq');
const ZreMsg = require('../lib/zre_msg');

describe('ZreMsg', () => {
  it('should create an instance of ZreMsg', () => {
    const zreMsg = new ZreMsg(ZreMsg.PING);
    assert.instanceOf(zreMsg, ZreMsg);
  });

  it('should create a new HELLO message and validate the output buffer', () => {
    const sequence = 1;
    const endpoint = 'tcp://127.0.0.1:50100';
    const groups = ['CHAT', 'TEST'];
    const status = 2;
    const name = 'node';
    const headers = {
      foo: 'bar',
      bob: 'omb',
    };

    const zreMsg = new ZreMsg(ZreMsg.HELLO, {
      sequence,
      endpoint,
      groups,
      status,
      name,
      headers,
    });

    const recvMsg = ZreMsg.read(zreMsg.toBuffer());

    assert.equal(recvMsg.getCmd(), ZreMsg.HELLO);
    assert.equal(recvMsg.getSequence(), sequence);
    assert.equal(recvMsg.getEndpoint(), endpoint);
    assert.sameMembers(recvMsg.getGroups(), groups);
    assert.equal(recvMsg.getStatus(), status);
    assert.equal(recvMsg.getName(), name);
    assert.deepEqual(recvMsg.getHeaders(), headers);
  });

  it('should not create a new HELLO message if sequence is not 1', () => {
    const sequence = 2;
    const endpoint = 'tcp://127.0.0.1:50100';
    const groups = ['CHAT', 'TEST'];
    const status = 2;
    const name = 'node';
    const headers = {
      foo: 'bar',
      bob: 'omb',
    };

    const zreMsg = new ZreMsg(ZreMsg.HELLO, {
      sequence,
      endpoint,
      groups,
      status,
      name,
      headers,
    });

    const recvMsg = ZreMsg.read(zreMsg.toBuffer());

    assert.isNotObject(recvMsg);
  });

  it('should create a new WHISPER message and validate the output buffer', () => {
    const sequence = 2;
    const content = 'Hello World!';

    const zreMsg = new ZreMsg(ZreMsg.WHISPER, {
      sequence,
      content,
    });

    const recvMsg = ZreMsg.read(zreMsg.toBuffer(), content);

    assert.equal(recvMsg.getCmd(), ZreMsg.WHISPER);
    assert.equal(recvMsg.getSequence(), sequence);
    assert.equal(recvMsg.getContent(), content);
  });

  it('should create a new SHOUT message and validate the output buffer', () => {
    const sequence = 3;
    const group = 'CHAT';
    const content = 'Hello World!';

    const zreMsg = new ZreMsg(ZreMsg.SHOUT, {
      sequence,
      group,
      content,
    });

    const recvMsg = ZreMsg.read(zreMsg.toBuffer(), content);

    assert.equal(recvMsg.getCmd(), ZreMsg.SHOUT);
    assert.equal(recvMsg.getSequence(), sequence);
    assert.equal(recvMsg.getGroup(), group);
    assert.equal(recvMsg.getContent(), content);
  });

  it('should create a new JOIN message and validate the output buffer', () => {
    const sequence = 4;
    const group = 'CHAT';
    const status = 1;

    const zreMsg = new ZreMsg(ZreMsg.JOIN, {
      sequence,
      group,
      status,
    });

    const recvMsg = ZreMsg.read(zreMsg.toBuffer());

    assert.equal(recvMsg.getCmd(), ZreMsg.JOIN);
    assert.equal(recvMsg.getSequence(), sequence);
    assert.equal(recvMsg.getGroup(), group);
    assert.equal(recvMsg.getStatus(), status);
  });

  it('should create a new LEAVE message and validate the output buffer', () => {
    const sequence = 5;
    const group = 'CHAT';
    const status = 1;

    const zreMsg = new ZreMsg(ZreMsg.LEAVE, {
      sequence,
      group,
      status,
    });

    const recvMsg = ZreMsg.read(zreMsg.toBuffer());

    assert.equal(recvMsg.getCmd(), ZreMsg.LEAVE);
    assert.equal(recvMsg.getSequence(), sequence);
    assert.equal(recvMsg.getGroup(), group);
    assert.equal(recvMsg.getStatus(), status);
  });

  it('should create a new PING message and validate the output buffer', () => {
    const sequence = 6;

    const zreMsg = new ZreMsg(ZreMsg.PING, {
      sequence,
    });

    const recvMsg = ZreMsg.read(zreMsg.toBuffer());

    assert.equal(recvMsg.getCmd(), ZreMsg.PING);
    assert.equal(recvMsg.getSequence(), sequence);
  });

  it('should create a new PING_OK message and validate the output buffer', () => {
    const sequence = 7;

    const zreMsg = new ZreMsg(ZreMsg.PING_OK, {
      sequence,
    });

    const recvMsg = ZreMsg.read(zreMsg.toBuffer());

    assert.equal(recvMsg.getCmd(), ZreMsg.PING_OK);
    assert.equal(recvMsg.getSequence(), sequence);
  });

  it('should discard reading corrupted messages', () => {
    const ZRE_VERSION = 2;
    const ZRE_HEADER = [0xAA, 0xA1];

    // Nothing is correct
    let buf = Buffer.alloc(20);
    buf.fill('a');
    let recvMsg = ZreMsg.read(buf);
    assert.isNotObject(recvMsg);

    // Header is correct
    buf = Buffer.alloc(18);
    buf.fill('a');
    buf = Buffer.concat([Buffer.from(ZRE_HEADER), buf]);
    recvMsg = ZreMsg.read(buf);
    assert.isNotObject(recvMsg);

    // Header and version are correct, but the command isn't
    buf = Buffer.alloc(1);
    buf.writeUInt8(42);
    let buf2 = Buffer.alloc(1);
    buf2.writeUInt8(ZRE_VERSION);
    buf = Buffer.concat([Buffer.from(ZRE_HEADER), buf, buf2]);
    recvMsg = ZreMsg.read(buf);
    assert.isNotObject(recvMsg);

    // Everything header related correct, but garbish content
    buf = Buffer.alloc(1);
    buf.writeUInt8(1);
    buf2 = Buffer.alloc(1);
    buf2.writeUInt8(ZRE_VERSION);
    const buf3 = Buffer.alloc(42);
    buf3.fill('a');
    buf = Buffer.concat([Buffer.from(ZRE_HEADER), buf, buf2, buf3]);
    recvMsg = ZreMsg.read(buf);
    assert.isNotObject(recvMsg);
  });

  it('should send a HELLO message with the given zeromq dealer socket', (done) => {
    const sequence = 1;
    const endpoint = 'tcp://127.0.0.1:42101';
    const groups = ['FOO', 'BAR'];
    const status = 2;
    const name = 'foobar';
    const headers = {
      john: 'appleseed',
      star: 'lord',
    };

    const zreMsg = new ZreMsg(ZreMsg.HELLO, {
      sequence,
      endpoint,
      groups,
      status,
      name,
      headers,
    });

    const router = zeromq.socket('router');
    const dealer = zeromq.socket('dealer');

    const address = 'tcp://127.0.0.1:42421';

    let hit = false;

    router.on('message', (id, msg) => {
      const recvMsg = ZreMsg.read(msg);

      assert.equal(recvMsg.getCmd(), ZreMsg.HELLO);
      assert.equal(recvMsg.getSequence(), sequence);
      assert.equal(recvMsg.getEndpoint(), endpoint);
      assert.sameMembers(recvMsg.getGroups(), groups);
      assert.equal(recvMsg.getStatus(), status);
      assert.equal(recvMsg.getName(), name);
      assert.deepEqual(recvMsg.getHeaders(), headers);

      hit = true;
    });

    router.bindSync(address);
    dealer.connect(address);

    const stopAll = () => {
      router.close();
      dealer.close();
      if (hit) setTimeout(() => { done(); }, 100);
    };

    zreMsg.send(dealer);

    setTimeout(stopAll, 100);
  });

  it('should send a WHISPER message with the given zeromq dealer socket', (done) => {
    const sequence = 42;
    const content = 'Hello World!';

    const zreMsg = new ZreMsg(ZreMsg.WHISPER, {
      sequence,
      content,
    });

    const router = zeromq.socket('router');
    const dealer = zeromq.socket('dealer');

    const address = 'tcp://127.0.0.1:42422';

    let hit = false;

    router.on('message', (id, msg, frame) => {
      const recvMsg = ZreMsg.read(msg, frame);

      assert.equal(recvMsg.getCmd(), ZreMsg.WHISPER);
      assert.equal(recvMsg.getSequence(), sequence);
      assert.equal(recvMsg.getContent(), content);

      hit = true;
    });

    router.bindSync(address);
    dealer.connect(address);

    const stopAll = () => {
      router.close();
      dealer.close();
      if (hit) setTimeout(() => { done(); }, 100);
    };

    zreMsg.send(dealer);

    setTimeout(stopAll, 100);
  });

  it('should set the sequence and group', () => {
    const sequence = 24;
    const group = 'FOO';
    const status = 1;

    const zreMsg = new ZreMsg(ZreMsg.JOIN, {
      sequence,
      group,
      status,
    });

    zreMsg.setGroup('BAR');
    zreMsg.setSequence(42);

    const recvMsg = ZreMsg.read(zreMsg.toBuffer());

    assert.equal(recvMsg.getCmd(), ZreMsg.JOIN);
    assert.equal(recvMsg.getSequence(), 42);
    assert.equal(recvMsg.getGroup(), 'BAR');
    assert.equal(recvMsg.getStatus(), status);
  });
});
