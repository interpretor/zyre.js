const assert = require('chai').assert;
const uuid = require('uuid');
const ZHelper = require('../lib/zhelper');
const ZBeacon = require('../lib/zbeacon');

describe('ZBeacon', () => {
  describe('constructor()', () => {
    it('should create an instance of ZBeacon', () => {
      const id = Buffer.alloc(16);
      uuid.v4(null, id, 0);
      const zBeacon = new ZBeacon(id, 51409, ZHelper.getIfData());
      assert.instanceOf(zBeacon, ZBeacon);
    });
  });

  describe('startBroadcast()', () => {
    it('should start broadcasting the zre beacon', (done) => {
      const id = Buffer.alloc(16);
      uuid.v4(null, id, 0);
      const zBeacon = new ZBeacon(id, 51409, ZHelper.getIfData());

      const id2 = Buffer.alloc(16);
      uuid.v4(null, id2, 0);
      const zBeacon2 = new ZBeacon(id2, 51410, ZHelper.getIfData());

      zBeacon.on('beacon', (dataGram) => {
        assert.equal(dataGram.id, id2.toString('hex'));
        zBeacon.stop();
        zBeacon2.stop();
        done();
      });

      zBeacon.startListening().then(() => {
        zBeacon2.startBroadcast();
      });
    });
  });
});
