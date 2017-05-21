const ZreMsg = require('./zre_msg');

module.exports = class ZyreGroup {

  constructor(name, zyrePeer) {
    this._name = name;
    this._peers = {};
    this.push(zyrePeer);
  }

  push(zyrePeer) {
    this._peers[zyrePeer.getIdentity()] = zyrePeer;
  }

  pop(identity) {
    delete this._peers[identity];
  }

  send(msg) {
    if (msg instanceof ZreMsg) {
      msg.setGroup(this._name);
      for (const i in this._peers) {
        if ({}.hasOwnProperty.call(this._peers, i)) {
          this._peers[i].send(msg);
        }
      }
    }
  }
};
