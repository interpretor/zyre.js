const assert = require('chai').assert;
const zyre = require('../lib/zyre');

describe('Zyre', () => {
  describe('new()', () => {
    it('should create a new instance of Zyre', () => {
      const zyre1 = zyre.new({ name: 'testName' });
      assert.equal(zyre1.name, 'testName');
    });
  });
});
