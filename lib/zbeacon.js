const dgram = require('dgram');
const debug = require('debug')('zyre:zbeacon');

const BEACON_VERSION = 1;
const BEACON_PORT = 5670;
const BEACON_INTERVAL = 1000;
const BEACON_ADDRESS = '0.0.0.0';

// Static header: Z R E {version}
const DG_HEADER = Buffer.from([0x5a, 0x52, 0x45, BEACON_VERSION]);
const MAILBOX_MIN = 49152;
const MAILBOX_MAX = 65535;

/**
 * Creates a new udp4 socket
 *
 * @access private
 * @return {Socket}
 */
function initializeNodeSock() {
  const nodeSock = dgram.createSocket('udp4');

  nodeSock.on('error', (err) => {
    debug(`nodeSock error:\n${err.stack}`);
    nodeSock.close();
  });

  return nodeSock;
}

/**
 * Creates a new udp4 socket that can be reused on the same port
 *
 * @access private
 * @return {Socket}
 */
function initializePeerSock() {
  const peerSock = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true,
  });

  peerSock.on('error', (err) => {
    debug(`peerSock error:\n${err.stack}`);
    peerSock.close();
  });

  return peerSock;
}

/**
 * Creates a new Buffer from the given parameters id and mailbox as specified by
 * the ZRE beacon protocol
 *
 * @access private
 * @param {Buffer} id
 * @param {number} mailbox
 * @return {Buffer}
 */
function createDataGramBuffer(id, mailbox) {
  if (!(id instanceof Buffer && id.length === 16)) {
    throw new Error('Wrong ID format; has to be a buffer with 16 bytes');
  }

  if (!(mailbox >= MAILBOX_MIN && mailbox <= MAILBOX_MAX)) {
    throw new Error(`Mailbox has to be in the range of ${MAILBOX_MIN} - ${MAILBOX_MAX}`);
  }

  // Write mailbox port in network order
  const dgMailbox = Buffer.alloc(2);
  dgMailbox.write(mailbox.toString(16), 'hex');

  return Buffer.concat([DG_HEADER, id, dgMailbox]);
}

/**
 * Reads and validates a given Buffer if it is valid against the ZRE beacon
 * protocol
 *
 * @access private
 * @param {Buffer} dgBuffer
 * @return {{id: string, mailbox: number}}
 */
function readDataGramBuffer(dgBuffer) {
  if (
    !dgBuffer.length === 22 &&
    !(dgBuffer.compare(DG_HEADER, 0, 4, 0, 4) === 0)
  ) {
    return undefined;
  }

  const dataGram = {};
  dataGram.id = dgBuffer.toString('hex', 4, 20);
  dataGram.mailbox = dgBuffer.readUInt16BE(20);

  return dataGram;
}

module.exports = class ZBeacon {

  /**
   * ZBeacon implements the beacon defined in the ZRE protocol, it listens for
   * foreign beacons and broadcasts his own
   *
   * @constructor
   * @param {Buffer} id
   * @param {number} mailbox
   * @param {Object} ifaceData
   * @param {ZyrePeer} zyrePeer
   */
  constructor({ id, mailbox, ifaceData, zyrePeer }) {
    this._dgBuffer = createDataGramBuffer(id, mailbox);
    this._bcAddr = ifaceData.broadcast;
    this._zyrePeer = zyrePeer;
  }

  /**
   * Starts broadcasting the beacon
   *
   * @return {Promise}
   */
  startBroadcasting() {
    this._nodeSock = initializeNodeSock();

    return new Promise((resolve) => {
      this._nodeSock.bind(() => {
        this._nodeSock.setBroadcast(true);
        this._broadcastTimer = setInterval(() => {
          this._nodeSock.send(this._dgBuffer, BEACON_PORT, this._bcAddr, () => {
            debug(`sent beacon to ${this._bcAddr}:${BEACON_PORT} [${this._dgBuffer.toString('hex')}]`);
          });
        }, BEACON_INTERVAL);
        resolve();
      });
    });
  }

  /**
   * Starts listening for foreign beacons
   *
   * @return {Promise}
   */
  startListening() {
    this._peerSock = initializePeerSock();

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

      debug(`got beacon from ${rinfo.address}:${rinfo.port} [${msg.toString('hex')}]`);

      const peer = {
        address: rinfo.address,
        port: dataGram.mailbox,
      };

      // Push discovered peer information
      this._zyrePeer.push(dataGram.id, 'beacon', peer);
    });

    return new Promise((resolve) => {
      this._peerSock.bind({
        address: BEACON_ADDRESS,
        port: BEACON_PORT,
      }, () => {
        resolve();
      });
    });
  }

  /**
   * Starts listening and broadcasting
   */
  start() {
    this.startListening();
    this.startBroadcasting();
  }

  /**
   * Stops every activity
   */
  stop() {
    if (this._broadcastTimer) clearTimeout(this._broadcastTimer);
    if (this._nodeSock) this._nodeSock.close();
    if (this._peerSock) this._peerSock.close();
  }
};
