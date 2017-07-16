/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const Zyre = require('../lib/zyre');

describe('Zyre', () => {
  it('should create a new instance of Zyre', () => {
    const zyre = new Zyre();
    assert.instanceOf(zyre, Zyre);

    const zyre2 = Zyre.new();
    assert.instanceOf(zyre2, Zyre);
  });

  it('should throw an error if interface data could not be found', () => {
    let hit = false;

    try {
      const zyre = new Zyre({ name: 'zyre1', iface: 'foobar123' });
      zyre.getIdentity();
    } catch (err) {
      if (err.message === 'Could not find IPv4 broadcast interface data') hit = true;
    }

    assert.isTrue(hit);
  });

  it('should inform about connected peers', (done) => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2', headers: { foo: 'bar' } });

    let hit = false;

    zyre1.on('connect', (id, name, headers) => {
      assert.strictEqual(id, zyre2.getIdentity());
      assert.strictEqual(name, 'zyre2');
      assert.deepEqual(headers, { foo: 'bar' });
      hit = true;
    });

    const stopAll = () => {
      zyre2.stop().then(() => {
        zyre1.stop().then(() => {
          if (hit) setTimeout(() => done(), 100);
        });
      });
    };

    zyre1.start().then(() => {
      zyre2.start().then(() => {
        setTimeout(stopAll, 100);
      });
    });
  });

  it('should inform about disconnected peers', (done) => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    zyre1.on('disconnect', (id, name) => {
      assert.strictEqual(id, zyre2.getIdentity());
      assert.strictEqual(name, 'zyre2');
      hit = true;
    });

    const stopZyre2 = () => {
      zyre2.stop();
    };

    const stopAll = () => {
      zyre1.stop().then(() => {
        if (hit) setTimeout(() => done(), 100);
      });
    };

    zyre1.start().then(() => {
      zyre2.start().then(() => {
        setTimeout(stopZyre2, 100);
        setTimeout(stopAll, 200);
      });
    });
  });

  it('should communicate with WHISPER messages', (done) => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    zyre1.on('whisper', (id, name, message) => {
      assert.strictEqual(id, zyre2.getIdentity());
      assert.strictEqual(name, 'zyre2');
      assert.strictEqual(message, 'Hey!');
      hit = true;
    });

    zyre2.on('whisper', (id, name, message) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(message, 'Hello World!');
      zyre2.whisper(zyre1.getIdentity(), 'Hey!');
    });

    const whisper = () => {
      zyre1.whisper(zyre2.getIdentity(), 'Hello World!');
    };

    const stopAll = () => {
      zyre2.stop().then(() => {
        zyre1.stop().then(() => {
          if (hit) setTimeout(() => done(), 100);
        });
      });
    };

    zyre1.start().then(() => {
      zyre2.start().then(() => {
        setTimeout(whisper, 100);
        setTimeout(stopAll, 200);
      });
    });
  });

  it('should communicate with SHOUT messages', (done) => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });
    const zyre3 = new Zyre({ name: 'zyre3' });

    let hit1 = false;
    let hit2 = false;

    zyre2.on('shout', (id, name, message, group) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(message, 'Hello World!');
      assert.strictEqual(group, 'CHAT');
      hit1 = true;
    });

    zyre3.on('shout', (id, name, message, group) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(message, 'Hello World!');
      assert.strictEqual(group, 'CHAT');
      hit2 = true;
    });

    const shout = () => {
      zyre1.shout('CHAT', 'Hello World!');
    };

    const stopAll = () => {
      zyre3.stop().then(() => {
        zyre2.stop().then(() => {
          zyre1.stop().then(() => {
            if (hit1 && hit2) setTimeout(() => done(), 100);
          });
        });
      });
    };

    zyre1.start().then(() => {
      zyre1.join('CHAT');
      zyre2.start().then(() => {
        zyre2.join('CHAT');
        zyre3.start().then(() => {
          zyre3.join('CHAT');
          setTimeout(shout, 100);
          setTimeout(stopAll, 200);
        });
      });
    });
  });

  it('should join a group and send JOIN messages', (done) => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    zyre2.on('join', (id, name, group) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(group, 'CHAT');
      assert.property(zyre2.getGroup('CHAT'), zyre1.getIdentity());
      hit = true;
    });

    const join = () => {
      zyre1.join('CHAT');
    };

    const stopAll = () => {
      zyre1.stop().then(() => {
        zyre2.stop().then(() => {
          if (hit) setTimeout(() => done(), 100);
        });
      });
    };

    zyre1.start().then(() => {
      zyre2.start().then(() => {
        setTimeout(join, 100);
        setTimeout(stopAll, 200);
      });
    });
  });

  it('should leave a group and send LEAVE messages', (done) => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    zyre2.on('leave', (id, name, group) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(group, 'CHAT');
      assert.isNotObject(zyre2.getGroup(name));
      hit = true;
    });

    const join = () => {
      zyre1.join('CHAT');
    };

    const leave = () => {
      zyre1.leave('CHAT');
    };

    const stopAll = () => {
      zyre1.stop().then(() => {
        zyre2.stop().then(() => {
          if (hit) setTimeout(() => done(), 100);
        });
      });
    };

    zyre1.start().then(() => {
      zyre2.start().then(() => {
        setTimeout(join, 100);
        setTimeout(leave, 200);
        setTimeout(stopAll, 300);
      });
    });
  });

  it('should return ZyrePeer(s) informations', (done) => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    const getPeers = () => {
      assert.isDefined(zyre1.getPeer(zyre2.getIdentity()));
      assert.property(zyre1.getPeers(), zyre2.getIdentity());
      assert.isDefined(zyre2.getPeer(zyre1.getIdentity()));
      assert.property(zyre2.getPeers(), zyre1.getIdentity());
      assert.isNotObject(zyre1.getPeer('foobar42123'));
      hit = true;
    };

    const stopAll = () => {
      zyre2.stop().then(() => {
        zyre1.stop().then(() => {
          if (hit) setTimeout(() => done(), 100);
        });
      });
    };

    zyre1.start().then(() => {
      zyre2.start().then(() => {
        setTimeout(getPeers, 100);
        setTimeout(stopAll, 200);
      });
    });
  });

  it('should return ZyreGroup(s) informations', (done) => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    const getGroups = () => {
      assert.isDefined(zyre1.getGroup('TEST'));
      assert.property(zyre1.getGroups(), 'TEST');
      assert.isDefined(zyre2.getGroup('TEST'));
      assert.property(zyre2.getGroups(), 'TEST');
      hit = true;
    };

    const stopAll = () => {
      zyre2.stop().then(() => {
        zyre1.stop().then(() => {
          if (hit) setTimeout(() => done(), 100);
        });
      });
    };

    zyre1.start().then(() => {
      zyre1.join('TEST');
      zyre2.start().then(() => {
        zyre2.join('TEST');
        setTimeout(getGroups, 100);
        setTimeout(stopAll, 200);
      });
    });
  });

  it('should inform about expired peers', (done) => {
    const evasive = 200;
    const expired = 400;

    const zyre1 = new Zyre({ name: 'zyre1', evasive, expired });
    const zyre2 = new Zyre({ name: 'zyre2', evasive, expired });

    let hit = false;

    zyre1.on('expired', (id, name) => {
      assert.strictEqual(id, zyre2.getIdentity());
      assert.strictEqual(name, 'zyre2');
      hit = true;
    });

    const stopTimeouts = () => {
      clearInterval(zyre1._zBeacon._broadcastTimer);
      clearInterval(zyre2._zBeacon._broadcastTimer);
      assert.isDefined(zyre1.getPeer(zyre2.getIdentity()));
      assert.isDefined(zyre2.getPeer(zyre1.getIdentity()));
      clearTimeout(zyre1._zyrePeers._peers[zyre2.getIdentity()]._evasiveTimeout);
      clearTimeout(zyre2._zyrePeers._peers[zyre1.getIdentity()]._evasiveTimeout);
    };

    const stopAll = () => {
      zyre2.stop().then(() => {
        zyre1.stop().then(() => {
          if (hit) setTimeout(() => done(), 100);
        });
      });
    };

    zyre1.start().then(() => {
      zyre2.start().then(() => {
        setTimeout(stopTimeouts, 100);
        setTimeout(stopAll, expired + 100);
      });
    });
  });

  it('should support different encodings for messages', (done) => {
    const zyre1 = new Zyre();
    const zyre2 = new Zyre();

    let hit = 0;

    zyre1.on('shout', (id, name, msg) => {
      hit += 1;
      if (hit === 1 || hit === 2) assert.isTrue(Buffer.isBuffer(msg));
      if (hit === 3) assert.strictEqual(msg, 'asdC$C6C<b\u0002,');
      if (hit === 4) assert.strictEqual(msg, 'asdäöü€');
      if (hit === 5 || hit === 6) assert.strictEqual(msg, '跧꒍軬뚎諮芲');
      if (hit === 7) assert.strictEqual(msg, 'WVhOa3c2VER0c084NG9Lcw==');
      if (hit === 8) assert.strictEqual(msg, 'asdÃÂ¤ÃÂ¶ÃÂ¼Ã¢ÂÂ¬');
      if (hit === 9) assert.strictEqual(msg, '363137333634633361346333623663336263653238326163');
      if (hit === 10) assert.strictEqual(msg, 'asdäöü€');
    });

    const stopAll = () => {
      zyre2.stop().then(() => {
        zyre1.stop().then(() => {
          if (hit === 10) setTimeout(() => done(), 100);
        });
      });
    };

    function sendMessage(encoding) {
      zyre1.setEncoding(encoding);

      if (encoding === null || encoding === 'raw') {
        zyre2.shout('CHAT', Buffer.from('asdäöü€'));
      } else if (encoding === 'garbish') {
        zyre2.shout('CHAT', 'asdäöü€');
      } else {
        zyre2.shout('CHAT', Buffer.from('asdäöü€').toString(encoding));
      }
    }

    zyre1.start().then(() => {
      zyre1.join('CHAT');
      zyre2.start().then(() => {
        zyre2.join('CHAT');
        setTimeout(() => sendMessage(null), 50);
        setTimeout(() => sendMessage('raw'), 100);
        setTimeout(() => sendMessage('ascii'), 150);
        setTimeout(() => sendMessage('utf8'), 200);
        setTimeout(() => sendMessage('utf16le'), 250);
        setTimeout(() => sendMessage('ucs2'), 300);
        setTimeout(() => sendMessage('base64'), 350);
        setTimeout(() => sendMessage('binary'), 400);
        setTimeout(() => sendMessage('hex'), 450);
        setTimeout(() => sendMessage('garbish'), 500);
        setTimeout(stopAll, 550);
      });
    });
  });
});
