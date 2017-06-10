/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const zyre = require('../lib/zyre');
const ZyrePeer = require('../lib/zyre_peer');

describe('Zyre', () => {
  it('should create a new instance of Zyre', () => {
    const z1 = zyre.new();
    assert.instanceOf(z1, zyre);
  });

  it('should throw an error if interface data could not be found', () => {
    let hit = false;

    try {
      zyre.new({ name: 'z1', iface: 'foobar123' });
    } catch (err) {
      if (err.message === 'Could not find IPv4 broadcast interface data') hit = true;
    }

    assert.isTrue(hit);
  });

  it('should inform about connected peers', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    let hit = false;

    z1.on('connect', (id, name) => {
      assert.equal(id, z2.getIdentity());
      assert.equal(name, 'z2');
      hit = true;
    });

    const stopAll = () => {
      z2.stop().then(() => {
        z1.stop().then(() => {
          if (hit) setTimeout(() => { done(); }, 100);
        });
      });
    };

    z1.start().then(() => {
      z2.start().then(() => {
        setTimeout(stopAll, 100);
      });
    });
  });

  it('should inform about disconnected peers', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    let hit = false;

    z1.on('disconnect', (id, name) => {
      assert.equal(id, z2.getIdentity());
      assert.equal(name, 'z2');
      hit = true;
    });

    const stopZ2 = () => {
      z2.stop();
    };

    const stopAll = () => {
      z1.stop().then(() => {
        if (hit) setTimeout(() => { done(); }, 100);
      });
    };

    z1.start().then(() => {
      z2.start().then(() => {
        setTimeout(stopZ2, 100);
        setTimeout(stopAll, 200);
      });
    });
  });

  it('should communicate with WHISPER messages', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    let hit = false;

    z1.on('whisper', (id, name, message) => {
      assert.equal(id, z2.getIdentity());
      assert.equal(name, 'z2');
      assert.equal(message, 'Hey!');
      hit = true;
    });

    z2.on('whisper', (id, name, message) => {
      assert.equal(id, z1.getIdentity());
      assert.equal(name, 'z1');
      assert.equal(message, 'Hello World!');
      z2.whisper(z1.getIdentity(), 'Hey!');
    });

    const whisper = () => {
      z1.whisper(z2.getIdentity(), 'Hello World!');
    };

    const stopAll = () => {
      z2.stop().then(() => {
        z1.stop().then(() => {
          if (hit) setTimeout(() => { done(); }, 100);
        });
      });
    };

    z1.start().then(() => {
      z2.start().then(() => {
        setTimeout(whisper, 100);
        setTimeout(stopAll, 200);
      });
    });
  });

  it('should communicate with SHOUT messages', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });
    const z3 = zyre.new({ name: 'z3' });

    let hit1 = false;
    let hit2 = false;

    z2.on('shout', (id, name, message, group) => {
      assert.equal(id, z1.getIdentity());
      assert.equal(name, 'z1');
      assert.equal(message, 'Hello World!');
      assert.equal(group, 'CHAT');
      hit1 = true;
    });

    z3.on('shout', (id, name, message, group) => {
      assert.equal(id, z1.getIdentity());
      assert.equal(name, 'z1');
      assert.equal(message, 'Hello World!');
      assert.equal(group, 'CHAT');
      hit2 = true;
    });

    const shout = () => {
      z1.shout('CHAT', 'Hello World!');
    };

    const stopAll = () => {
      z3.stop().then(() => {
        z2.stop().then(() => {
          z1.stop().then(() => {
            if (hit1 && hit2) setTimeout(() => { done(); }, 100);
          });
        });
      });
    };

    z1.start().then(() => {
      z1.join('CHAT');
      z2.start().then(() => {
        z2.join('CHAT');
        z3.start().then(() => {
          z3.join('CHAT');
          setTimeout(shout, 100);
          setTimeout(stopAll, 200);
        });
      });
    });
  });

  it('should join a group and send JOIN messages', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    let hit = false;

    z2.on('join', (id, name, group) => {
      assert.equal(id, z1.getIdentity());
      assert.equal(name, 'z1');
      assert.equal(group, 'CHAT');
      assert.property(z2.getGroup('CHAT'), z1.getIdentity());
      hit = true;
    });

    const join = () => {
      z1.join('CHAT');
    };

    const stopAll = () => {
      z1.stop().then(() => {
        z2.stop().then(() => {
          if (hit) setTimeout(() => { done(); }, 100);
        });
      });
    };

    z1.start().then(() => {
      z2.start().then(() => {
        setTimeout(join, 100);
        setTimeout(stopAll, 200);
      });
    });
  });

  it('should leave a group and send LEAVE messages', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    let hit = false;

    z2.on('leave', (id, name, group) => {
      assert.equal(id, z1.getIdentity());
      assert.equal(name, 'z1');
      assert.equal(group, 'CHAT');
      assert.isNotObject(z2.getGroup(name));
      hit = true;
    });

    const join = () => {
      z1.join('CHAT');
    };

    const leave = () => {
      z1.leave('CHAT');
    };

    const stopAll = () => {
      z1.stop().then(() => {
        z2.stop().then(() => {
          if (hit) setTimeout(() => { done(); }, 100);
        });
      });
    };

    z1.start().then(() => {
      z2.start().then(() => {
        setTimeout(join, 100);
        setTimeout(leave, 200);
        setTimeout(stopAll, 300);
      });
    });
  });

  it('should return ZyrePeer(s) informations', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    let hit = false;

    const getPeers = () => {
      assert.isDefined(z1.getPeer(z2.getIdentity()));
      assert.property(z1.getPeers(), z2.getIdentity());
      assert.isDefined(z2.getPeer(z1.getIdentity()));
      assert.property(z2.getPeers(), z1.getIdentity());
      assert.isNotObject(z1.getPeer('foobar42123'));
      hit = true;
    };

    const stopAll = () => {
      z2.stop().then(() => {
        z1.stop().then(() => {
          if (hit) setTimeout(() => { done(); }, 100);
        });
      });
    };

    z1.start().then(() => {
      z2.start().then(() => {
        setTimeout(getPeers, 100);
        setTimeout(stopAll, 200);
      });
    });
  });

  it('should return ZyreGroup(s) informations', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    let hit = false;

    const getGroups = () => {
      assert.isDefined(z1.getGroup('TEST'));
      assert.property(z1.getGroups(), 'TEST');
      assert.isDefined(z2.getGroup('TEST'));
      assert.property(z2.getGroups(), 'TEST');
      hit = true;
    };

    const stopAll = () => {
      z2.stop().then(() => {
        z1.stop().then(() => {
          if (hit) setTimeout(() => { done(); }, 100);
        });
      });
    };

    z1.start().then(() => {
      z1.join('TEST');
      z2.start().then(() => {
        z2.join('TEST');
        setTimeout(getGroups, 100);
        setTimeout(stopAll, 200);
      });
    });
  });

  it('should inform about expired peers', function (done) {
    // Set higher timeout to test expired peers
    this.timeout(ZyrePeer.PEER_EXPIRED + 10000);

    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    let hit = false;

    z1.on('expired', (id, name) => {
      assert.equal(id, z2.getIdentity());
      assert.equal(name, 'z2');
      hit = true;
    });

    const stopTimeouts = () => {
      clearInterval(z1._zBeacon._broadcastTimer);
      clearInterval(z2._zBeacon._broadcastTimer);
      assert.isDefined(z1.getPeer(z2.getIdentity()));
      assert.isDefined(z2.getPeer(z1.getIdentity()));
      clearTimeout(z1._zyrePeers._peers[z2.getIdentity()]._evasiveTimeout);
      clearTimeout(z2._zyrePeers._peers[z1.getIdentity()]._evasiveTimeout);
    };

    const stopAll = () => {
      z2.stop().then(() => {
        z1.stop().then(() => {
          if (hit) setTimeout(() => { done(); }, 100);
        });
      });
    };

    z1.start().then(() => {
      z2.start().then(() => {
        setTimeout(stopTimeouts, 100);
        setTimeout(stopAll, ZyrePeer.PEER_EXPIRED + 100);
      });
    });
  });

  it('should inform about peers that are back from being expired', function (done) {
    // Set higher timeout to test expired peers
    this.timeout(ZyrePeer.PEER_EXPIRED + 10000);

    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    let hit = false;

    z1.on('back', (id, name) => {
      assert.equal(id, z2.getIdentity());
      assert.equal(name, 'z2');
      hit = true;
    });

    const stopTimeouts = () => {
      clearInterval(z1._zBeacon._broadcastTimer);
      clearInterval(z2._zBeacon._broadcastTimer);
      assert.isDefined(z1.getPeer(z2.getIdentity()));
      assert.isDefined(z2.getPeer(z1.getIdentity()));
      clearTimeout(z1._zyrePeers._peers[z2.getIdentity()]._evasiveTimeout);
      clearTimeout(z2._zyrePeers._peers[z1.getIdentity()]._evasiveTimeout);
    };

    const startBroadcast = () => {
      z2._zBeacon.startBroadcasting();
    };

    const stopAll = () => {
      z2.stop().then(() => {
        z1.stop().then(() => {
          if (hit) setTimeout(() => { done(); }, 100);
        });
      });
    };

    z1.start().then(() => {
      z2.start().then(() => {
        setTimeout(stopTimeouts, 100);
        setTimeout(startBroadcast, ZyrePeer.PEER_EXPIRED + 100);
        setTimeout(stopAll, ZyrePeer.PEER_EXPIRED + 200);
      });
    });
  });
});
