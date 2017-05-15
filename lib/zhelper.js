const os = require('os');

module.exports = class ZHelper {

  // Returns public IPv4 interface data from given interface and calculates broadcast address;
  // Returns an object
  static getIfDataFrom(iface) {
    const ifaceData = os.networkInterfaces()[iface];

    if (!ifaceData) {
      return undefined;
    }

    let pubIPv4;
    Object.values(ifaceData).forEach((i) => {
      if (!i.internal && i.family === 'IPv4') {
        pubIPv4 = i;
      }
    });

    if (!pubIPv4) {
      return undefined;
    }

    const address = pubIPv4.address.split('.');
    const netmask = pubIPv4.netmask.split('.');
    let broadcast = '';

    address.forEach((e, i) => {
      broadcast += (e | (netmask[i] ^ 255));
      if (i < address.length - 1) {
        broadcast += '.';
      }
    });

    pubIPv4.broadcast = broadcast;

    return pubIPv4;
  }

  // Returns public IPv4 interface data of a valid interface with assigned IPv4; Returns an object
  static getIfData() {
    const ifaces = os.networkInterfaces();

    if (!ifaces) {
      return undefined;
    }

    let iface;
    Object.keys(ifaces).some((i) => {
      iface = this.getIfDataFrom(i);
      if (iface) {
        return true;
      }
      return false;
    });

    return iface;
  }
};
