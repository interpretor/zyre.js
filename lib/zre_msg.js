/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const zeromq = require('zeromq');

const ZRE_VERSION = 2;
const ZRE_HEADER = [0xAA, 0xA1];

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
  return Buffer.concat([putNumber1(str.length), Buffer.from(str)]);
}

function getString(buf) {
  return buf.toString(undefined, 1, getNumber1(buf) + 1);
}

function putLongString(str) {
  return Buffer.concat([putNumber4(str.length), Buffer.from(str)]);
}

function getLongString(buf) {
  return buf.toString(undefined, 4, getNumber4(buf) + 4);
}

function putStrings(strArr) {
  let stringsBuffer = putNumber4(strArr.length);
  strArr.forEach((e) => {
    stringsBuffer = Buffer.concat([stringsBuffer, putLongString(e)]);
  });
  return stringsBuffer;
}

function getStrings(buf) {
  const stringsArray = [];
  const count = getNumber4(buf);
  let pointer = 4;
  for (let i = 0; i < count; i += 1) {
    const position = buf.slice(pointer);
    stringsArray.push(getLongString(position));
    pointer += getNumber4(position) + 4;
  }
  return { strings: stringsArray, pointer };
}

function putDictionary(obj) {
  let dictBuffer = putNumber4(Object.keys(obj).length);
  for (const i in obj) {
    if ({}.hasOwnProperty.call(obj, i)) {
      dictBuffer = Buffer.concat([dictBuffer, putString(i), putLongString(obj[i])]);
    }
  }
  return dictBuffer;
}

function getDictionary(buf) {
  const dictObj = {};
  const count = getNumber4(buf);
  let pointer = 4;
  for (let i = 0; i < count; i += 1) {
    const position = buf.slice(pointer);
    const valuePointer = pointer + getNumber1(position) + 1;
    const valuePosition = buf.slice(valuePointer);
    dictObj[getString(position)] = getLongString(valuePosition);
    pointer = valuePointer + getNumber4(valuePosition) + 4;
  }
  return { dictionary: dictObj, pointer };
}

/**
 * ZreMsg represents a message in ZRE format
 */
class ZreMsg {

  /**
   * @param {number} cmd - ZreMsg command as number
   * @param {Object} [options] - Options Object
   * @param {number} [options.sequence=1] - Sequence of the message
   * @param {string} [options.group] - Group which the node/peer joins or leaves
   * @param {string} [options.content] - Content of the message
   * @param {string} [options.endpoint] - TCP address of the node/peer
   * @param {string[]} [options.groups] - Groups in which the node/peer participates
   * @param {number} [options.status] - Groups status of the node/peer
   * @param {string} [options.name] - Name of the node/peer
   * @param {Object} [options.headers] - Headers of the node/peer
   */
  constructor(cmd, { sequence = 1, group, content, endpoint, groups, status, name, headers } = {}) {
    this._cmd = cmd;
    this._sequence = sequence;
    if (typeof group !== 'undefined') this._group = group;
    if (typeof content !== 'undefined') this._content = content;
    if (typeof endpoint !== 'undefined') this._endpoint = endpoint;
    if (typeof groups !== 'undefined') this._groups = groups;
    if (typeof status !== 'undefined') this._status = status;
    if (typeof name !== 'undefined') this._name = name;
    if (typeof headers !== 'undefined') this._headers = headers;
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
   * @return {string} Content of the message
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
   * @return {Object} Headers of the node/peer
   */
  getHeaders() {
    return this._headers;
  }

  /**
   * @param {number} sequence Sequence of the message
   */
  setSequence(sequence) {
    this._sequence = sequence;
  }

  /**
   * @param {string} group Group which the node/peer joins or leaves
   */
  setGroup(group) {
    this._group = group;
  }

  /**
   * Sends this ZreMsg with the given zeromq dealer socket
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
   * Creates a binary Buffer from this ZreMsg
   *
   * @return {Buffer} Binary Buffer in ZreMsg format
   */
  toBuffer() {
    const bufArr = [];

    bufArr.push(Buffer.from(ZRE_HEADER));
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
   * Reads, validates and creates a new ZreMsg from the given Buffer and frame
   *
   * @param {Buffer} buffer - Binary Buffer in ZreMsg format
   * @param {string} frame - Message content as string
   * @return {ZreMsg}
   */
  static read(buffer, frame) {
    try {
      if (!(Buffer.from(ZRE_HEADER).compare(buffer, 0, 2, 0, 2) === 0)) return undefined;
      if (!(getNumber1(buffer.slice(3)) === ZRE_VERSION)) return undefined;

      switch (getNumber1(buffer.slice(2))) {
        case HELLO: {
          let pointer = 4;
          let position = buffer.slice(pointer);

          const sequence = getNumber2(position);
          pointer += 2;
          position = buffer.slice(pointer);

          const endpoint = getString(position);
          pointer += getNumber1(position) + 1;
          position = buffer.slice(pointer);

          const groupStrings = getStrings(position);
          const groups = groupStrings.strings;
          pointer += groupStrings.pointer;
          position = buffer.slice(pointer);

          const status = getNumber1(position);
          pointer += 1;
          position = buffer.slice(pointer);

          const name = getString(position);
          pointer += getNumber1(position) + 1;
          position = buffer.slice(pointer);

          const headersObj = getDictionary(position);
          const headers = headersObj.dictionary;

          return new ZreMsg(HELLO, { sequence, endpoint, groups, status, name, headers });
        }

        case WHISPER: {
          const pointer = 4;
          const position = buffer.slice(pointer);

          const sequence = getNumber2(position);

          return new ZreMsg(WHISPER, { sequence, content: frame });
        }

        case SHOUT: {
          let pointer = 4;
          let position = buffer.slice(pointer);

          const sequence = getNumber2(position);
          pointer += 2;
          position = buffer.slice(pointer);

          const group = getString(position);

          return new ZreMsg(SHOUT, { sequence, group, content: frame });
        }

        case JOIN: {
          let pointer = 4;
          let position = buffer.slice(pointer);

          const sequence = getNumber2(position);
          pointer += 2;
          position = buffer.slice(pointer);

          const group = getString(position);
          pointer += getNumber1(position) + 1;
          position = buffer.slice(pointer);

          const status = getNumber1(position);

          return new ZreMsg(JOIN, { sequence, group, status });
        }

        case LEAVE: {
          let pointer = 4;
          let position = buffer.slice(pointer);

          const sequence = getNumber2(position);
          pointer += 2;
          position = buffer.slice(pointer);

          const group = getString(position);
          pointer += getNumber1(position) + 1;
          position = buffer.slice(pointer);

          const status = getNumber1(position);

          return new ZreMsg(LEAVE, { sequence, group, status });
        }

        case PING: {
          const pointer = 4;
          const position = buffer.slice(pointer);

          const sequence = getNumber2(position);

          return new ZreMsg(PING, { sequence });
        }

        case PING_OK: {
          const pointer = 4;
          const position = buffer.slice(pointer);

          const sequence = getNumber2(position);

          return new ZreMsg(PING_OK, { sequence });
        }

        default:
          return undefined;
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
