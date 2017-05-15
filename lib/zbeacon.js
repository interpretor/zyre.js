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

function initializeNodeSock() {
  const nodeSock = dgram.createSocket('udp4');

  nodeSock.on('error', (err) => {
    debug(`nodeSock error:\n${err.stack}`);
    nodeSock.close();
  });

  return nodeSock;
}

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

function readDataGramBuffer(dgBuffer) {
  if (!dgBuffer.length === 22 && !(dgBuffer.compare(DG_HEADER, 0, 4, 0, 4) === 0)) {
    return undefined;
  }

  const dataGram = {};
  dataGram.id = dgBuffer.toString('hex', 4, 20);
  dataGram.mailbox = dgBuffer.readUInt16BE(20);

  return dataGram;
}

module.exports = class ZBeacon {

  constructor({ id, mailbox, ifaceData, zyrePeer }) {
    this.nodeSock = initializeNodeSock();
    this.peerSock = initializePeerSock();
    this.dgBuffer = createDataGramBuffer(id, mailbox);
    this.bcAddr = ifaceData.broadcast;
    this.zyrePeer = zyrePeer;
  }

  startBroadcast() {
    return new Promise((resolve) => {
      this.nodeSock.bind(() => {
        this.nodeSock.setBroadcast(true);

        this.broadcasting = setInterval(() => {
          this.nodeSock.send(this.dgBuffer, BEACON_PORT, this.bcAddr, () => {
            debug(`sent beacon to ${this.bcAddr}:${BEACON_PORT} [${this.dgBuffer.toString('hex')}]`);
          });
        }, BEACON_INTERVAL);

        resolve();
      });
    });
  }

  startListening() {
    this.peerSock.on('listening', () => {
      const address = this.peerSock.address();
      debug(`listening on ${address.address}:${address.port}`);
    });

    this.peerSock.on('message', (msg, rinfo) => {
      // Return if received own beacon
      if (msg.equals(this.dgBuffer)) {
        return;
      }

      // Return if received no valid zbeacon datagram
      const dataGram = readDataGramBuffer(msg);
      if (!dataGram) {
        return;
      }

      debug(`got beacon from ${rinfo.address}:${rinfo.port} [${msg.toString('hex')}]`);

      const peer = {
        address: rinfo.address,
        port: dataGram.mailbox,
      };

      // Push discovered peer information
      this.zyrePeer.push(dataGram.id, 'beacon', peer);
    });

    return new Promise((resolve) => {
      this.peerSock.bind({
        address: BEACON_ADDRESS,
        port: BEACON_PORT,
      }, () => {
        resolve();
      });
    });
  }

  stop() {
    clearTimeout(this.broadcasting);
    this.nodeSock.close();
    this.peerSock.close();
  }
};
