const ZyreGroup = require('./zyre_group');

module.exports = class ZyreGroups {

  constructor() {
    this._groups = {};
  }

  push(name, zyrePeer) {
    if (name) {
      if (this._groups[name]) {
        this._groups[name].push(zyrePeer);
      } else {
        const zyreGroup = new ZyreGroup(name, zyrePeer);
        this._groups[name] = zyreGroup;
      }
    }
  }

  pop(name, identity) {
    if (name) {
      if (this._groups[name]) {
        this._groups[name].pop(identity);
      }
    }
  }

  getGroup(name) {
    return this._groups[name];
  }
};
