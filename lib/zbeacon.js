/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const dgram = require('dgram');
const debug = require('debug')('zyre:zbeacon');

const BEACON_VERSION = 1;
const BEACON_PORT = 5670;
const BEACON_INTERVAL = 1000;

// Static header: Z R E {version}
const DG_HEADER = [0x5a, 0x52, 0x45, BEACON_VERSION];
const MAILBOX_MIN = 49152;
const MAILBOX_MAX = 65535;

/**
 * Creates a new UDP datagram as Buffer in the ZRE beacon format
 *
 * @protected
 * @param {Buffer} identity - 16 byte UUID as Buffer
 * @param {number} mailbox - Network port of the zyre node
 * @return {Buffer} Binary Buffer in ZRE beacon format
 */
function createDataGramBuffer(identity, mailbox) {
  if (!(identity instanceof Buffer && identity.length === 16)) {
    throw new Error('Wrong identity format; has to be a buffer with 16 bytes');
  }

  if (!(mailbox >= MAILBOX_MIN && mailbox <= MAILBOX_MAX)) {
    throw new Error(`Mailbox has to be in the range of ${MAILBOX_MIN} - ${MAILBOX_MAX}`);
  }

  // Write mailbox port in network order
  const dgMailbox = Buffer.alloc(2);
  dgMailbox.writeUInt16BE(mailbox);

  return Buffer.concat([Buffer.from(DG_HEADER), identity, dgMailbox]);
}

/**
 * @typedef {Object} DataGram
 * @property {string} identity - UUID as string
 * @property {number} mailbox - Network port
 */

/**
 * Reads and validates a given Buffer if it is valid against the ZRE beacon format, returns an
 * object with the identity and the mailbox port
 *
 * @protected
 * @param {Buffer} dgBuffer - UDP datagram buffer
 * @return {DataGram}
 */
function readDataGramBuffer(dgBuffer) {
  if (!(dgBuffer.length === 22)) return undefined;
  if (!(dgBuffer.compare(Buffer.from(DG_HEADER), 0, 4, 0, 4) === 0)) return undefined;

  const dataGram = {};
  dataGram.identity = dgBuffer.toString('hex', 4, 20);
  dataGram.mailbox = dgBuffer.readUInt16BE(20);

  return dataGram;
}

/**
 * ZBeacon implements the discovery beacon defined in the ZRE protocol, it listens for foreign
 * beacons and broadcasts his own datagram
 */
class ZBeacon {

  /**
   * @param {Object} options - Options Object
   * @param {Buffer} options.identity - 16 byte UUID as Buffer
   * @param {string} options.address - Address of the zyre node
   * @param {number} options.mailbox - Mailbox of the zyre node
   * @param {ZyrePeers} options.zyrePeers - Global ZyrePeers object
   */
  constructor({ identity, address, mailbox, zyrePeers }) {
    this._dgBuffer = createDataGramBuffer(identity, mailbox);
    this._address = address;
    this._zyrePeers = zyrePeers;
  }

  /**
   * Starts broadcasting the beacon
   *
   * @return {Promise}
   */
  startBroadcasting() {
    this._nodeSock = dgram.createSocket('udp4');

    this._nodeSock.on('error', (err) => {
      debug(`nodeSock error:\n${err.stack}`);
      this._nodeSock.close();
    });

    return new Promise((resolve) => {
      this._nodeSock.bind(() => {
        this._nodeSock.setBroadcast(true);
        this._broadcastTimer = setInterval(() => {
          this._nodeSock.send(this._dgBuffer, BEACON_PORT, this._address, () => {
            debug(`to ${this._address}:${BEACON_PORT}`);
          });
        }, BEACON_INTERVAL);
        resolve();
      });
    });
  }

  /**
   * Starts listening for foreign beacons and pushes discovered peers to the ZyrePeers object
   *
   * @return {Promise}
   */
  startListening() {
    this._peerSock = dgram.createSocket({
      type: 'udp4',
      reuseAddr: true,
    });

    this._peerSock.on('error', (err) => {
      debug(`peerSock error:\n${err.stack}`);
      this._peerSock.close();
    });

    this._peerSock.on('listening', () => {
      const address = this._peerSock.address();
      debug(`listening on ${address.address}:${address.port}`);
    });

    this._peerSock.on('message', (msg, rinfo) => {
      // Return if received own beacon
      if (msg.equals(this._dgBuffer)) return;

      // Return if received no valid zbeacon datagram
      const dataGram = readDataGramBuffer(msg);
      if (!dataGram) return;

      debug(`from ${rinfo.address}:${rinfo.port}`);

      this._zyrePeers.push({
        identity: dataGram.identity,
        address: rinfo.address,
        mailbox: dataGram.mailbox,
      });
    });

    return new Promise((resolve) => {
      this._peerSock.bind({
        address: '0.0.0.0',
        port: BEACON_PORT,
      }, () => {
        resolve();
      });
    });
  }

  /**
   * Starts listening and broadcasting
   *
   * @return {Promise}
   */
  start() {
    return new Promise((resolve) => {
      this.startListening().then(() => {
        this.startBroadcasting().then(() => {
          resolve();
        });
      });
    });
  }

  /**
   * Stops every activity
   */
  stop() {
    if (this._broadcastTimer) clearInterval(this._broadcastTimer);
    if (this._nodeSock) this._nodeSock.close();
    if (this._peerSock) this._peerSock.close();
  }
}

module.exports = ZBeacon;
