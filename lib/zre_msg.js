/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const zeromq = require('zeromq');

const ZRE_VERSION = 2;
const ZRE_HEADER = Buffer.from([0xAA, 0xA1]);

const HELLO = 1;
const WHISPER = 2;
const SHOUT = 3;
const JOIN = 4;
const LEAVE = 5;
const PING = 6;
const PING_OK = 7;

function putNumber1(num) {
  const buf = Buffer.alloc(1);
  buf.writeUInt8(num);
  return buf;
}

function getNumber1(buf) {
  return buf.readUInt8();
}

function putNumber2(num) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16BE(num);
  return buf;
}

function getNumber2(buf) {
  return buf.readUInt16BE();
}

function putNumber4(num) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(num);
  return buf;
}

function getNumber4(buf) {
  return buf.readUInt32BE();
}

function putString(str) {
  return Buffer.concat([
    putNumber1(Buffer.byteLength(str, 'utf8')),
    Buffer.from(str, 'utf8'),
  ]);
}

function getString(buf) {
  const pointer = getNumber1(buf) + 1;
  const value = buf.toString('utf8', 1, pointer);
  return { value, pointer };
}

function putLongString(str) {
  return Buffer.concat([
    putNumber4(Buffer.byteLength(str, 'utf8')),
    Buffer.from(str, 'utf8'),
  ]);
}

function getLongString(buf) {
  const pointer = getNumber4(buf) + 4;
  const value = buf.toString('utf8', 4, pointer);
  return { value, pointer };
}

function putStrings(strArr) {
  let stringsBuffer = putNumber4(strArr.length);

  strArr.forEach((e) => {
    stringsBuffer = Buffer.concat([
      stringsBuffer,
      putLongString(String(e)),
    ]);
  });

  return stringsBuffer;
}

function getStrings(buf) {
  const count = getNumber4(buf);
  const value = [];
  let pointer = 4;

  for (let i = 0; i < count; i += 1) {
    const string = getLongString(buf.slice(pointer));
    value.push(string.value);
    pointer += string.pointer;
  }

  return { value, pointer };
}

function putDictionary(obj) {
  let dictBuffer = putNumber4(Object.keys(obj).length);

  Object.keys(obj).forEach((i) => {
    dictBuffer = Buffer.concat([
      dictBuffer,
      putString(String(i)),
      putLongString(String(obj[i])),
    ]);
  });

  return dictBuffer;
}

function getDictionary(buf) {
  const count = getNumber4(buf);
  const value = {};
  let pointer = 4;

  for (let i = 0; i < count; i += 1) {
    const keyString = getString(buf.slice(pointer));
    const valuePointer = pointer + keyString.pointer;
    const valueString = getLongString(buf.slice(valuePointer));
    value[keyString.value] = valueString.value;
    pointer = valuePointer + valueString.pointer;
  }

  return { value, pointer };
}

/**
 * ZreMsg represents a message in ZRE format.
 */
class ZreMsg {

  /**
   * @param {number} cmd - ZreMsg command as number
   * @param {object} [options] - Options object
   * @param {number} [options.sequence=1] - Sequence of the message
   * @param {string} [options.group] - Group which the node/peer joins or leaves
   * @param {Buffer} [options.content] - Content of the message
   * @param {string} [options.endpoint] - TCP address of the node/peer
   * @param {string[]} [options.groups] - Groups in which the node/peer participates
   * @param {number} [options.status] - Groups status of the node/peer
   * @param {string} [options.name] - Name of the node/peer
   * @param {object} [options.headers] - Headers of the node/peer
   */
  constructor(cmd, { sequence = 1, group, content, endpoint, groups, status, name, headers } = {}) {
    this._cmd = cmd;
    this._sequence = sequence;
    this._group = group;
    this._content = content;
    this._endpoint = endpoint;
    this._groups = groups;
    this._status = status;
    this._name = name;
    this._headers = headers;
  }

  /**
   * @return {number} ZreMsg command as number
   */
  getCmd() {
    return this._cmd;
  }

  /**
   * @return {number} Sequence of the message
   */
  getSequence() {
    return this._sequence;
  }

  /**
   * @return {string} Group which the node/peer joins or leaves
   */
  getGroup() {
    return this._group;
  }

  /**
   * @return {Buffer} Content of the message
   */
  getContent() {
    return this._content;
  }

  /**
   * @return {string} TCP address of the node/peer
   */
  getEndpoint() {
    return this._endpoint;
  }

  /**
   * @return {string[]} Groups in which the node/peer participates
   */
  getGroups() {
    return this._groups;
  }

  /**
   * @return {number} Groups status of the node/peer
   */
  getStatus() {
    return this._status;
  }

  /**
   * @return {string} Name of the node/peer
   */
  getName() {
    return this._name;
  }

  /**
   * @return {object} Headers of the node/peer
   */
  getHeaders() {
    return this._headers;
  }

  /**
   * @param {number} sequence - Sequence of the message
   */
  setSequence(sequence) {
    this._sequence = sequence;
  }

  /**
   * @param {string} group - Group which the node/peer joins or leaves
   */
  setGroup(group) {
    this._group = group;
  }

  /**
   * Sends this ZreMsg with the given zeromq dealer socket.
   *
   * @param {zeromq.Socket} socket - Zeromq dealer socket
   * @return {Promise}
   */
  send(socket) {
    return new Promise((resolve) => {
      if (this._cmd === WHISPER || this._cmd === SHOUT) {
        socket.send(this.toBuffer(), zeromq.ZMQ_SNDMORE);
        socket.send(this._content, 0, () => {
          resolve(this._cmd);
        });
      } else {
        socket.send(this.toBuffer(), 0, () => {
          resolve(this._cmd);
        });
      }
    });
  }

  /**
   * Creates a binary Buffer from this ZreMsg.
   *
   * @return {Buffer} Binary Buffer in ZreMsg format
   */
  toBuffer() {
    const bufArr = [];

    bufArr.push(ZRE_HEADER);
    bufArr.push(putNumber1(this._cmd));
    bufArr.push(putNumber1(ZRE_VERSION));
    bufArr.push(putNumber2(this._sequence));
    if (typeof this._group !== 'undefined') bufArr.push(putString(this._group));
    if (typeof this._endpoint !== 'undefined') bufArr.push(putString(this._endpoint));
    if (typeof this._groups !== 'undefined') bufArr.push(putStrings(this._groups));
    if (typeof this._status !== 'undefined') bufArr.push(putNumber1(this._status));
    if (typeof this._name !== 'undefined') bufArr.push(putString(this._name));
    if (typeof this._headers !== 'undefined') bufArr.push(putDictionary(this._headers));

    return Buffer.concat(bufArr);
  }

  /**
   * Reads, validates and creates a new ZreMsg from the given Buffer and frame.
   *
   * @param {Buffer} buffer - Binary Buffer in ZreMsg format
   * @param {Buffer} frame - Message content as binary Buffer
   * @return {ZreMsg}
   */
  static read(buffer, frame) {
    try {
      if (buffer.compare(ZRE_HEADER, 0, 2, 0, 2) !== 0) throw Error;
      if (getNumber1(buffer.slice(3)) !== ZRE_VERSION) throw Error;

      switch (getNumber1(buffer.slice(2))) {
        case HELLO: {
          let pointer = 4;

          const sequence = getNumber2(buffer.slice(pointer));
          pointer += 2;

          // A HELLO message always has to be the first message
          if (sequence !== 1) throw Error;

          const endpointString = getString(buffer.slice(pointer));
          const endpoint = endpointString.value;
          pointer += endpointString.pointer;

          const groupsStrings = getStrings(buffer.slice(pointer));
          const groups = groupsStrings.value;
          pointer += groupsStrings.pointer;

          const status = getNumber1(buffer.slice(pointer));
          pointer += 1;

          const nameString = getString(buffer.slice(pointer));
          const name = nameString.value;
          pointer += nameString.pointer;

          const headers = getDictionary(buffer.slice(pointer)).value;

          return new ZreMsg(HELLO, { sequence, endpoint, groups, status, name, headers });
        }

        case WHISPER: {
          const pointer = 4;

          const sequence = getNumber2(buffer.slice(pointer));

          return new ZreMsg(WHISPER, { sequence, content: frame });
        }

        case SHOUT: {
          let pointer = 4;

          const sequence = getNumber2(buffer.slice(pointer));
          pointer += 2;

          const group = getString(buffer.slice(pointer)).value;

          return new ZreMsg(SHOUT, { sequence, group, content: frame });
        }

        case JOIN: {
          let pointer = 4;

          const sequence = getNumber2(buffer.slice(pointer));
          pointer += 2;

          const groupString = getString(buffer.slice(pointer));
          const group = groupString.value;
          pointer += groupString.pointer;

          const status = getNumber1(buffer.slice(pointer));

          return new ZreMsg(JOIN, { sequence, group, status });
        }

        case LEAVE: {
          let pointer = 4;

          const sequence = getNumber2(buffer.slice(pointer));
          pointer += 2;

          const groupString = getString(buffer.slice(pointer));
          const group = groupString.value;
          pointer += groupString.pointer;

          const status = getNumber1(buffer.slice(pointer));

          return new ZreMsg(LEAVE, { sequence, group, status });
        }

        case PING: {
          const pointer = 4;

          const sequence = getNumber2(buffer.slice(pointer));

          return new ZreMsg(PING, { sequence });
        }

        case PING_OK: {
          const pointer = 4;

          const sequence = getNumber2(buffer.slice(pointer));

          return new ZreMsg(PING_OK, { sequence });
        }

        default:
          throw Error;
      }
    } catch (err) {
      return undefined;
    }
  }
}

ZreMsg.HELLO = HELLO;
ZreMsg.WHISPER = WHISPER;
ZreMsg.SHOUT = SHOUT;
ZreMsg.JOIN = JOIN;
ZreMsg.LEAVE = LEAVE;
ZreMsg.PING = PING;
ZreMsg.PING_OK = PING_OK;

module.exports = ZreMsg;
