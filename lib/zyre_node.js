const debug = require('debug')('zyre:zyre_node');
const zeromq = require('zeromq');
const ZreMsg = require('./zre_msg');

module.exports = class ZyreNode {

  constructor({ identity, name, mailbox, ifaceData, zyrePeers }) {
    this._identity = identity;
    this._name = name;
    this._mailbox = mailbox;
    this._address = ifaceData.address;
    this._zyrePeers = zyrePeers;
  }

  startListening() {
    this._socket = zeromq.socket('router');

    this._socket.on('message', (id, msg, frame) => {
      const zreMsg = ZreMsg.read(msg, frame);
      if (!zreMsg) return;

      const identity = id.slice(1).toString('hex');

      debug(`${identity}: received msg ${zreMsg.getCmd()}`);

      const helloMsg = ZreMsg.create('hello', {
        sequence: zreMsg.getSequence(),
        endpoint: `tcp://${this._address}:${this._mailbox}`,
        groups: ['CHAT'],
        status: 1,
        name: this._name,
        headers: {},
      });

      const shoutMsg = ZreMsg.create('shout', {
        sequence: zreMsg.getSequence(),
        group: 'CHAT',
      });

      if (zreMsg.getCmd() === 1) {
        this._zyrePeers.push({
          identity,
          name: zreMsg.getName(),
          address: zreMsg.getEndpoint().split(':')[1].split('//')[1],
          mailbox: zreMsg.getEndpoint().split(':')[2],
        });
        this._zyrePeers.getPeer(identity).connect();
        this._zyrePeers.getPeer(identity).send(helloMsg.toBuffer());
      } else if (zreMsg.getCmd() === 3) {
        console.log(zreMsg.getContent().toString());
        this._zyrePeers.getPeer(identity).sendMore(shoutMsg.toBuffer());
        this._zyrePeers.getPeer(identity).send('Hello World!');
      }
    });

    return new Promise((resolve) => {
      this._socket.bind(`tcp://${this._address}:${this._mailbox}`, () => {
        debug(`listening on ${this._address}:${this._mailbox}`);
        resolve();
      });
    });
  }
};
