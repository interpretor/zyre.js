const assert = require('chai').assert;
const ZHelper = require('../lib/zhelper');

describe('ZHelper', () => {
  it('should create an instance of ZHelper', () => {
    const zHelper = new ZHelper();
    assert.instanceOf(zHelper, ZHelper);
  });

  it('should return public IPv4 interface data', () => {
    const ifdata = ZHelper.getIfData();
    assert.propertyVal(ifdata, 'family', 'IPv4');
    assert.property(ifdata, 'broadcast');
  });
});
