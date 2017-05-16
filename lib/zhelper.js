const os = require('os');

module.exports = class ZHelper {

  /**
   * Returns IPv4 interface data from the given interface, or searches for a
   * public interface with an assigned IPv4. Also calculates the broadcast
   * address of the interface.
   *
   * @param {String} [iface]
   * @return {Object}
   */
  static getIfData(iface) {
    const ifaces = os.networkInterfaces();
    if (!ifaces) return undefined;

    if (!iface) {
      let y;
      Object.keys(ifaces).some((i) => {
        y = this.getIfData(i);
        if (y) return true;
        return false;
      });

      return y;
    }

    if (!ifaces[iface]) return undefined;

    let pubIPv4;
    Object.values(ifaces[iface]).forEach((i) => {
      if (!i.internal && i.family === 'IPv4') {
        pubIPv4 = i;
      }
    });

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
};
