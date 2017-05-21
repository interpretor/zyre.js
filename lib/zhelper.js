const os = require('os');
const tcpPortUsed = require('tcp-port-used');

module.exports = class ZHelper {

  /**
   * Returns IPv4 interface data from the given interface, or searches for a
   * public interface with an assigned IPv4. Also calculates the broadcast
   * address of the interface.
   *
   * @param {string} [iface]
   * @return {Object}
   */
  static getIfData(iface) {
    const ifaces = os.networkInterfaces();
    if (!ifaces) return undefined;

    if (!iface) {
      for (const i in ifaces) {
        if ({}.hasOwnProperty.call(ifaces, i)) {
          const y = this.getIfData(i);
          if (y) return y;
        }
      }
      return undefined;
    }

    const selIface = ifaces[iface];
    if (!selIface) return undefined;

    let pubIPv4;
    for (const i in selIface) {
      if ({}.hasOwnProperty.call(selIface, i)) {
        if (!selIface[i].internal && selIface[i].family === 'IPv4') {
          pubIPv4 = selIface[i];
        }
      }
    }

    if (!pubIPv4) return undefined;

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

  /**
   * Finds a free tcp port starting from the given port, incremented by one
   *
   * @param {string} address
   * @param {number} port
   * @return {Promise}
   */
  static getFreePort(address, port) {
    return new Promise((resolve) => {
      tcpPortUsed.check(port, address).then((used) => {
        if (used) {
          this.getFreePort(address, port + 1).then((portRec) => {
            resolve(portRec);
          });
        } else {
          resolve(port);
        }
      });
    });
  }
};
