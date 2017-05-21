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

class ZreMsg {

  constructor(cmd, { sequence = 1, group, content, endpoint, groups, status, name, headers }) {
    this._cmd = cmd;
    this._sequence = sequence;
    if (group) this._group = group;
    if (content) this._content = content;
    if (endpoint) this._endpoint = endpoint;
    if (groups) this._groups = groups;
    if (status) this._status = status;
    if (name) this._name = name;
    if (headers) this._headers = headers;
  }

  setSequence(sequence) {
    this._sequence = sequence;
  }

  setGroup(group) {
    this._group = group;
  }

  getCmd() {
    return this._cmd;
  }

  getSequence() {
    return this._sequence;
  }

  getGroup() {
    return this._group;
  }

  getContent() {
    return this._content;
  }

  getEndpoint() {
    return this._endpoint;
  }

  getGroups() {
    return this._groups;
  }

  getStatus() {
    return this._status;
  }

  getName() {
    return this._name;
  }

  getHeaders() {
    return this._headers;
  }

  send(socket) {
    return new Promise((resolve, reject) => {
      if (socket instanceof zeromq.Socket) {
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
      } else {
        reject();
      }
    });
  }

  toBuffer() {
    const bufArr = [];

    bufArr.push(Buffer.from(ZRE_HEADER));
    bufArr.push(putNumber1(this._cmd));
    bufArr.push(putNumber1(ZRE_VERSION));
    bufArr.push(putNumber2(this._sequence));
    if (this._group) bufArr.push(putString(this._group));
    if (this._endpoint) bufArr.push(putString(this._endpoint));
    if (this._groups) bufArr.push(putStrings(this._groups));
    if (this._status) bufArr.push(putNumber1(this._status));
    if (this._name) bufArr.push(putString(this._name));
    if (this._headers) bufArr.push(putDictionary(this._headers));

    return Buffer.concat(bufArr);
  }

  static read(buffer, frame) {
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
