const EventEmitter = require('events');
const uuid = require('uuid');
const ZHelper = require('./zhelper');
const ZBeacon = require('./zbeacon');

class Zyre extends EventEmitter {
  constructor({ name, iface }) {
    super();

    if (iface) {
      this.ifaceData = ZHelper.getIfDataFrom(iface);
    } else {
      this.ifaceData = ZHelper.getIfData();
    }

    if (!this.ifaceData) {
      throw new Error('Could not find IPv4 broadcast interface data');
    }

    // Create new uuid
    this.id = Buffer.alloc(16);
    uuid.v4(null, this.id, 0);

    // Set the name to the first six bytes of the uuid if a custom name is not given
    if (name) {
      this.name = name;
    } else {
      this.name = this.id.toString('hex', 0, 6);
    }

    this.zBeacon = new ZBeacon(this.id, 50000, this.ifaceData);
    this.zBeacon.startListening().then(() => {
      this.zBeacon.startBroadcast();
    });
  }

  toString() {
    return this;
  }
}

exports.new = ({ name, iface }) => {
  const zyre = new Zyre({ name, iface });
  return zyre;
};
