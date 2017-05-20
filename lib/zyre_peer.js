const EventEmitter = require('events');
const debug = require('debug')('zyre:zyre_peer');
const zeromq = require('zeromq');

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
   * @param {Buffer} originID
   */
  constructor({ identity, name = '', address, mailbox, originID }) {
    super();

    this.update({ identity, name, address, mailbox });
    this._originID = originID;
    this._connected = false;
    this._evasiveAt = 0;
    this._expiredAt = 0;
    this._sequence = 0;
  }

  connect() {
    this._socket = zeromq.socket('dealer', {
      identity: Buffer.concat([Buffer.from([ID_PREFIX]), this._originID]),
    });

    this._socket.connect(`tcp://${this._address}:${this._mailbox}`);
    this._connected = true;
    debug(`${this._identity}: connected to peer`);
  }

  disconnect() {
    if (this._connected) {
      this._socket.close();
      this._connected = false;
      debug(`${this._identity}: disconnected from peer`);
    }
  }

  send(msg) {
    return new Promise((resolve, reject) => {
      if (this._connected) {
        this._socket.send(msg, 0, () => {
          debug(`${this._identity}: sent msg to peer`);
          resolve();
        });
      } else {
        reject();
      }
    });
  }

  sendMore(msg) {
    return new Promise((resolve, reject) => {
      if (this._connected) {
        this._socket.send(msg, zeromq.ZMQ_SNDMORE, () => {
          debug(`${this._identity}: sending more...`);
          resolve();
        });
      } else {
        reject();
      }
    });
  }

  update({ identity, name, address, mailbox }) {
    this._identity = identity;
    if (name) this._name = name;
    this._address = address;
    this._mailbox = mailbox;

    clearTimeout(this._evasiveTimeout);
    clearTimeout(this._expiredTimeout);

    this._evasiveTimeout = setTimeout(() => {
      this._evasiveAt = Date.now();
      this.emit('evasive');
      debug(`${this._identity}: peer evasive at ${this._evasiveAt}`);
    }, PEER_EVASIVE);

    this._expiredTimeout = setTimeout(() => {
      this._expiredAt = Date.now();
      this.emit('expired');
      debug(`${this._identity}: peer expired at ${this._expiredAt}`);
      this.disconnect();
    }, PEER_EXPIRED);
  }
};
