const uuid = require('uuid');
const ZHelper = require('./zhelper');
const ZBeacon = require('./zbeacon');
const ZyrePeer = require('./zyre_peer');

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
    this._id = Buffer.alloc(16);
    uuid.v4(null, this._id, 0);

    // Set the name to the first six bytes of the uuid if a custom name is not given
    if (name) {
      this._name = name;
    } else {
      this._name = this._id.toString('hex', 0, 6);
    }

    this._zyrePeer = new ZyrePeer();

    this._zBeacon = new ZBeacon({
      id: this._id,
      mailbox: 53123,
      ifaceData: this._ifaceData,
      zyrePeer: this._zyrePeer,
    });

    this._zBeacon.start();
  }

  getName() {
    return this._name;
  }
}

exports.new = ({ name, iface } = {}) => {
  const zyre = new Zyre({ name, iface });
  return zyre;
};
