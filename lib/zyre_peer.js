const EventEmitter = require('events');
const debug = require('debug')('zyre:zyre_peer');
const zeromq = require('zeromq');
const ZreMsg = require('./zre_msg');

const PEER_EVASIVE = 5000;
const PEER_EXPIRED = 30000;

const ID_PREFIX = 1;

module.exports = class ZyrePeer extends EventEmitter {

  /**
   * Every ZyrePeer instance holds one unique peer found by either a received
   * udp beacon or a received message
   *
   * @constructor
   * @param {string} identity
   * @param {string} [name]
   * @param {string} address
   * @param {number} mailbox
   * @param {string} [endpoint]
   * @param {string[]} [groups]
   * @param {number} [sequence]
   * @param {Buffer} originID
   */
  constructor({
    identity,
    name = '',
    address,
    mailbox,
    endpoint,
    groups,
    sequence,
    originID,
  }) {
    super();

    this._identity = identity;
    this.update({ name, address, mailbox, endpoint, groups, sequence });
    this._originID = originID;
    this._connected = false;
    this._evasiveAt = 0;
    this._expiredAt = 0;
    if (!sequence) this._sequenceIn = 0;
    this._sequenceOut = 1;
  }

  connect() {
    this._socket = zeromq.socket('dealer', {
      identity: Buffer.concat([Buffer.from([ID_PREFIX]), this._originID]),
    });

    this._socket.connect(this._endpoint);
    this._connected = true;
    debug(`${this._identity}: connected`);
  }

  disconnect() {
    if (this._connected) {
      this._socket.close();
      this._connected = false;
      debug(`${this._identity}: disconnected`);
    }
  }

  send(msg) {
    return new Promise((resolve, reject) => {
      if (this._connected && msg instanceof ZreMsg) {
        msg.setSequence(this._sequenceOut);
        this._sequenceOut += 1;
        msg.send(this._socket).then((cmd) => {
          debug(`${this._identity}: sent message (${cmd})`);
          resolve();
        });
      } else {
        reject();
      }
    });
  }

  update({ name, address, mailbox, endpoint, groups, sequence }) {
    if (name) this._name = name;
    if (endpoint) {
      this._endpoint = endpoint;
    } else if (address && mailbox) {
      this._endpoint = `tcp://${address}:${mailbox}`;
    }
    if (groups) this._groups = groups;
    if (sequence) this._sequenceIn = sequence;

    clearTimeout(this._evasiveTimeout);
    clearTimeout(this._expiredTimeout);
    this._evasiveAt = 0;
    this._expiredAt = 0;
    // TODO re-expired

    this._evasiveTimeout = setTimeout(() => {
      this._evasiveAt = Date.now();
      this.emit('evasive');
      debug(`${this._identity}: evasive at ${this._evasiveAt}`);
    }, PEER_EVASIVE);

    this._expiredTimeout = setTimeout(() => {
      this._expiredAt = Date.now();
      this.emit('expired');
      debug(`${this._identity}: expired at ${this._expiredAt}`);
      this.disconnect();
    }, PEER_EXPIRED);
  }
};
