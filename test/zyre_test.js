const assert = require('chai').assert;
const zre = require('../lib/zyre');

describe('Zyre', () => {
  it('should create a new instance of Zyre', () => {
    const zyre = zre.new({ name: 'testName' });
    assert.equal(zyre.getName(), 'testName');
  });
});
