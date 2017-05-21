const debug = require('debug')('zyre:zyre_node');
const zeromq = require('zeromq');
const ZreMsg = require('./zre_msg');
const ZyreGroups = require('./zyre_groups');

module.exports = class ZyreNode {

  constructor({ identity, name, address, mailbox, headers = {}, zyrePeers }) {
    this._identity = identity;
    this._name = name;
    this._endpoint = `tcp://${address}:${mailbox}`;
    this._headers = headers;
    this._zyrePeers = zyrePeers;
    this._status = 1;
    this._zyreGroups = new ZyreGroups();
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
        headers: this._headers,
      }));
    });

    this._socket.on('message', (id, msg, frame) => {
      const zreMsg = ZreMsg.read(msg, frame);
      if (!zreMsg) {
        debug('got malformed message');
        return;
      }

      const identity = id.slice(1).toString('hex');

      debug(`${identity}: received message (${zreMsg.getCmd()})`);

      // If received HELLO message
      if (zreMsg.getCmd() === ZreMsg.HELLO) {
        this._zyrePeers.push({
          identity,
          sequence: zreMsg.getSequence(),
          endpoint: zreMsg.getEndpoint(),
          status: zreMsg.getStatus(),
          name: zreMsg.getName(),
          headers: zreMsg.getHeaders(),
        });

        zreMsg.getGroups().forEach((e) => {
          this._zyreGroups.push(e, this._zyrePeers.getPeer(identity));
        });
      // If received other than HELLO message from unknown peer
      } else if (!this._zyrePeers.getPeer(identity)) {
        debug(`${identity}: unknown peer wants to send (${zreMsg.getCmd()})`);
        return;
      // If received other messages from known peers
      } else {
        this._zyrePeers.push({
          identity,
          sequence: zreMsg.getSequence(),
          status: zreMsg.getStatus(),
        });

        if (zreMsg.getCmd() === ZreMsg.JOIN) {
          this._zyreGroups.push(zreMsg.getGroup(), this._zyrePeers.getPeer(identity));
        } else if (zreMsg.getCmd === ZreMsg.LEAVE) {
          this._zyreGroups.pop(zreMsg.getGroup(), identity);
        }
      }

      // Mocking
      if (zreMsg.getCmd() === ZreMsg.SHOUT) {
        this._zyreGroups.getGroup('CHAT').send(new ZreMsg(ZreMsg.SHOUT, {
          content: 'Hello World!',
        }));
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
