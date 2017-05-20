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
  return buf.toString('utf8', 1, getNumber1(buf) + 1);
}

function putLongString(str) {
  return Buffer.concat([putNumber4(str.length), Buffer.from(str)]);
}

function getLongString(buf) {
  return buf.toString('utf8', 4, getNumber4(buf) + 4);
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
  let pointer = 4;
  for (let i = 0; i < getNumber4(buf); i += 1) {
    stringsArray.push(getLongString(buf.slice(pointer)));
    pointer += getNumber4(buf.slice(pointer)) + 4;
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
  let pointer = 4;
  for (let i = 0; i < getNumber4(buf); i += 1) {
    const valuePointer = pointer + getNumber1(buf.slice(pointer)) + 1;
    dictObj[getString(buf.slice(pointer))] = getLongString(buf.slice(valuePointer));
    pointer = valuePointer + getNumber4(buf.slice(valuePointer)) + 4;
  }
  return { dictionary: dictObj, pointer };
}

module.exports = class ZreMsg {

  constructor(cmd, { sequence, group, content, endpoint, groups, status, name, headers }) {
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

  toBuffer() {
    const bufArr = [];

    bufArr.push(Buffer.from(ZRE_HEADER));
    bufArr.push(putNumber1(this._cmd));
    bufArr.push(putNumber1(ZRE_VERSION));
    bufArr.push(putNumber2(this._sequence));
    if (this._group) bufArr.push(putString(this._group));
    if (this._content) bufArr.push(Buffer.from(this._content));
    if (this._endpoint) bufArr.push(putString(this._endpoint));
    if (this._groups) bufArr.push(putStrings(this._groups));
    if (this._status) bufArr.push(putNumber1(this._status));
    if (this._name) bufArr.push(putString(this._name));
    if (this._headers) bufArr.push(putDictionary(this._headers));

    return Buffer.concat(bufArr);
  }

  static create(cmd, { sequence, group, content, endpoint, groups, status, name, headers }) {
    switch (cmd) {
      case 'hello':
        return new ZreMsg(HELLO, { sequence, endpoint, groups, status, name, headers });

      case 'whisper':
        return new ZreMsg(WHISPER, { sequence, content });

      case 'shout':
        return new ZreMsg(SHOUT, { sequence, group, content });

      case 'join':
        return new ZreMsg(JOIN, { sequence, group, status });

      case 'leave':
        return new ZreMsg(LEAVE, { sequence, group, status });

      case 'ping':
        return new ZreMsg(PING, { sequence });

      case 'ping_ok':
        return new ZreMsg(PING_OK, { sequence });

      default:
        return undefined;
    }
  }

  static read(buffer, frame) {
    if (!(Buffer.from(ZRE_HEADER).compare(buffer, 0, 2, 0, 2) === 0)) {
      return undefined;
    }

    if (!(getNumber1(buffer.slice(3)) === ZRE_VERSION)) return undefined;

    switch (getNumber1(buffer.slice(2))) {
      case HELLO: {
        let pointer = 4;
        const sequence = getNumber2(buffer.slice(pointer));
        pointer += 2;

        const endpoint = getString(buffer.slice(pointer));
        pointer += getNumber1(buffer.slice(pointer)) + 1;

        const groupStrings = getStrings(buffer.slice(pointer));
        const groups = groupStrings.strings;
        pointer += groupStrings.pointer;

        const status = getNumber1(buffer.slice(pointer));
        pointer += 1;

        const name = getString(buffer.slice(pointer));
        pointer += getNumber1(buffer.slice(pointer)) + 1;

        const headersObj = getDictionary(buffer.slice(pointer));
        const headers = headersObj.dictionary;

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

        const group = getString(buffer.slice(pointer));

        return new ZreMsg(SHOUT, { sequence, group, content: frame });
      }

      case JOIN: {
        let pointer = 4;
        const sequence = getNumber2(buffer.slice(pointer));
        pointer += 2;

        const group = getString(buffer.slice(pointer));
        pointer += getNumber1(buffer.slice(pointer)) + 1;

        const status = getNumber1(buffer.slice(pointer));

        return new ZreMsg(JOIN, { sequence, group, status });
      }

      case LEAVE: {
        let pointer = 4;
        const sequence = getNumber2(buffer.slice(pointer));
        pointer += 2;

        const group = getString(buffer.slice(pointer));
        pointer += getNumber1(buffer.slice(pointer)) + 1;

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
        return undefined;
    }
  }
};
