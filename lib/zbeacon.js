/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const dgram = require('dgram');
const debug = require('debug')('zyre:zbeacon');
const ZHelper = require('./zhelper');

// Static header: Z R E {version}
const BEACON_VERSION = 1;
const BEACON_HEADER = Buffer.from([0x5a, 0x52, 0x45, BEACON_VERSION]);

/**
 * Creates a new UDP datagram as Buffer in the ZRE beacon format.
 *
 * @protected
 * @param {Buffer} identity - 16 byte UUID as Buffer
 * @param {number} mailbox - Network port of the zyre node
 * @return {Buffer} Binary Buffer in ZRE beacon format
 */
function createDataGramBuffer(identity, mailbox) {
  // Write mailbox port in network order
  const dgMailbox = Buffer.alloc(2);
  dgMailbox.writeUInt16BE(mailbox);

  return Buffer.concat([BEACON_HEADER, identity, dgMailbox]);
}

/**
 * @typedef {object} DataGram
 * @property {string} identity - UUID as string
 * @property {number} mailbox - Network port
 */

/**
 * Reads and validates a given Buffer, returns an object with the identity and the mailbox port.
 *
 * @protected
 * @param {Buffer} dgBuffer - UDP datagram buffer
 * @return {DataGram}
 */
function readDataGramBuffer(dgBuffer) {
  try {
    if (dgBuffer.length !== 22) throw Error;
    if (dgBuffer.compare(BEACON_HEADER, 0, 4, 0, 4) !== 0) throw Error;

    const dataGram = {};
    dataGram.identity = dgBuffer.toString('hex', 4, 20);
    dataGram.mailbox = dgBuffer.readUInt16BE(20);

    return dataGram;
  } catch (err) {
    return undefined;
  }
}

/**
 * ZBeacon implements the discovery beacon defined in the ZRE protocol, it listens for foreign
 * beacons and broadcasts his own datagram.
 */
class ZBeacon {

  /**
   * @param {object} options - Options object
   * @param {Buffer} options.identity - 16 byte UUID as Buffer
   * @param {number} options.mailbox - Mailbox of the zyre node
   * @param {IfaceData} options.ifaceData - Interface data
   * @param {number} [options.port=5670] - Broadcast port
   * @param {number} [options.interval=1000] - Interval of the beacon in ms
   * @param {ZyrePeers} options.zyrePeers - Global ZyrePeers object
   */
  constructor({ identity, mailbox, ifaceData, port = 5670, interval = 1000, zyrePeers }) {
    this._identity = identity;
    this._mailbox = mailbox;
    this._network = ifaceData.network;
    this._netmask = ifaceData.netmask;
    this._broadcast = ifaceData.broadcast;
    this._port = port;
    this._interval = interval;
    this._zyrePeers = zyrePeers;
    this._dgBuffer = createDataGramBuffer(identity, mailbox);
  }

  /**
   * Starts broadcasting the beacon.
   *
   * @return {Promise}
   */
  startBroadcasting() {
    this._nodeSock = dgram.createSocket('udp4');

    this._sendBroadcast = () => {
      this._nodeSock.send(this._dgBuffer, this._port, this._broadcast, () => {
        debug(`sent beacon to ${this._broadcast}:${this._port}`);
      });
    };

    return new Promise((resolve) => {
      this._nodeSock.bind(() => {
        this._nodeSock.setBroadcast(true);
        this._sendBroadcast();
        this._broadcastTimer = setInterval(this._sendBroadcast, this._interval);
        resolve();
      });
    });
  }

  /**
   * Starts listening for foreign beacons and pushes discovered peers to the ZyrePeers object.
   *
   * @return {Promise}
   */
  startListening() {
    this._peerSock = dgram.createSocket({
      type: 'udp4',
      reuseAddr: true,
    });

    this._peerSock.on('listening', () => {
      const address = this._peerSock.address();
      debug(`listening on ${address.address}:${address.port}`);
    });

    this._peerSock.on('message', (msg, rinfo) => {
      // Return if received own beacon
      if (msg.equals(this._dgBuffer)) return;

      // Return if received udp beacon from different subnet
      if (!ZHelper.ipInSubnet(rinfo.address, this._network, this._netmask)) return;

      // Return if received no valid zbeacon datagram
      const dataGram = readDataGramBuffer(msg);
      if (typeof dataGram === 'undefined') return;

      debug(`got beacon from ${rinfo.address}:${rinfo.port}`);

      this._zyrePeers.push({
        identity: dataGram.identity,
        address: rinfo.address,
        mailbox: dataGram.mailbox,
      });
    });

    return new Promise((resolve) => {
      this._peerSock.bind({
        address: '0.0.0.0',
        port: this._port,
      }, () => {
        resolve();
      });
    });
  }

  /**
   * Starts listening and broadcasting.
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
   * Sends disconnect beacon and stops every activity.
   *
   * @return {Promise}
   */
  stop() {
    clearInterval(this._broadcastTimer);

    if (typeof this._peerSock !== 'undefined') {
      this._peerSock.removeAllListeners();
      this._peerSock.close();
    }

    return new Promise((resolve) => {
      if (typeof this._nodeSock !== 'undefined') {
        const dcdgBuffer = createDataGramBuffer(this._identity, 0);
        this._nodeSock.send(dcdgBuffer, this._port, this._broadcast, () => {
          debug(`sent disconnect beacon to ${this._broadcast}:${this._port}`);
          this._nodeSock.close(() => {
            resolve();
          });
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = ZBeacon;
