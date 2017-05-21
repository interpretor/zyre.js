const uuid = require('uuid');
const ZHelper = require('./zhelper');
const ZyrePeers = require('./zyre_peers');
const ZyreNode = require('./zyre_node');
const ZBeacon = require('./zbeacon');

const MAILBOX = 49152;

class Zyre {

  constructor({ name, iface }) {
    if (iface) {
      this._ifaceData = ZHelper.getIfData(iface);
    } else {
      this._ifaceData = ZHelper.getIfData();
    }

    if (!this._ifaceData) {
      throw new Error('Could not find IPv4 broadcast interface data');
    }

    // Create new uuid
    this._identity = Buffer.alloc(16);
    uuid.v4(null, this._identity, 0);

    // Set the name to the first six bytes of the uuid if name is not given
    if (name) {
      this._name = name;
    } else {
      this._name = this._identity.toString('hex', 0, 6);
    }

    this._zyrePeers = new ZyrePeers(this._identity);

    ZHelper.getFreePort(this._ifaceData.address, MAILBOX).then((port) => {
      this._zyreNode = new ZyreNode({
        identity: this._identity,
        name: this._name,
        address: this._ifaceData.address,
        mailbox: port,
        zyrePeers: this._zyrePeers,
      });

      this._zyreNode.startListening();

      this._zBeacon = new ZBeacon({
        identity: this._identity,
        address: this._ifaceData.broadcast,
        mailbox: port,
        zyrePeers: this._zyrePeers,
      });

      this._zBeacon.start();
    });
  }

  getName() {
    return this._name;
  }
}

exports.new = ({ name, iface } = {}) => new Zyre({ name, iface });
