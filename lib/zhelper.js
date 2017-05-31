/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const os = require('os');
const tcpPortUsed = require('tcp-port-used');

/**
 * ZHelper contains some necessary static helper methods
 */
class ZHelper {

  /**
   * @typedef {Object} IfaceData
   * @property {string} address - IP address
   * @property {string} netmask - Netmask
   * @property {string} family - IPv4 or IPv6
   * @property {string} mac - MAC address
   * @property {boolean} internal - Internal or external
   * @property {string} broadcast - Broadcast address
   */

  /**
   * Returns IPv4 interface data from the given interface, or searches for a public interface with
   * an assigned IPv4. Also calculates the broadcast address of the interface.
   *
   * @param {string} [iface] - Optional interface to check
   * @return {IfaceData}
   */
  static getIfData(iface) {
    const ifaces = os.networkInterfaces();
    if (typeof ifaces === 'undefined') return undefined;

    if (typeof iface === 'undefined') {
      for (const i in ifaces) {
        if ({}.hasOwnProperty.call(ifaces, i)) {
          const y = this.getIfData(i);
          if (typeof y !== 'undefined') return y;
        }
      }

      return undefined;
    }

    const selIface = ifaces[iface];
    if (typeof selIface === 'undefined') return undefined;

    let pubIPv4;
    for (const i in selIface) {
      if ({}.hasOwnProperty.call(selIface, i)) {
        if (!selIface[i].internal && selIface[i].family === 'IPv4') {
          pubIPv4 = selIface[i];
        }
      }
    }

    if (typeof pubIPv4 === 'undefined') return undefined;

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
   * Finds a free TCP port starting from the given port, incremented by one
   *
   * @param {string} address - Address to search on
   * @param {number} port - Port to start searching from
   * @return {Promise.<port>}
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
}

module.exports = ZHelper;
