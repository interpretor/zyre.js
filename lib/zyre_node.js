const debug = require('debug')('zyre:zyre_node');
const zeromq = require('zeromq');
const ZreMsg = require('./zre_msg');

module.exports = class ZyreNode {

  constructor({ identity, name, address, mailbox, zyrePeers }) {
    this._identity = identity;
    this._name = name;
    this._endpoint = `tcp://${address}:${mailbox}`;
    this._zyrePeers = zyrePeers;
    this._status = 1;
  }

  startListening() {
    this._socket = zeromq.socket('router');

    this._zyrePeers.on('new', (zyrePeer) => {
      zyrePeer.connect();
      zyrePeer.send(new ZreMsg(ZreMsg.HELLO, {
        endpoint: this._endpoint,
        groups: ['CHAT'],
        status: this._status,
        name: this._name,
        headers: {},
      }));
    });

    this._socket.on('message', (id, msg, frame) => {
      const zreMsg = ZreMsg.read(msg, frame);
      if (!zreMsg) return;

      const identity = id.slice(1).toString('hex');

      debug(`${identity}: received message (${zreMsg.getCmd()})`);

      this._zyrePeers.push({
        identity,
        name: zreMsg.getName(),
        endpoint: zreMsg.getEndpoint(),
        groups: zreMsg.getGroups(),
        sequence: zreMsg.getSequence(),
      });

      // Mocking
      if (zreMsg.getCmd() === ZreMsg.SHOUT) {
        const shoutMsg = new ZreMsg(ZreMsg.SHOUT, {
          group: 'CHAT',
          content: 'Hello World!',
        });
        this._zyrePeers.getPeer(identity).send(shoutMsg);
      }
    });

    return new Promise((resolve) => {
      this._socket.bind(this._endpoint, () => {
        debug(`listening on ${this._endpoint}`);
        resolve();
      });
    });
  }
};
