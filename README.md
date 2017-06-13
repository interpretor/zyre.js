# zyre.js

[![Build Status](https://travis-ci.org/interpretor/zyre.js.svg?branch=master)](https://travis-ci.org/interpretor/zyre.js)
[![Build status](https://ci.appveyor.com/api/projects/status/plddo0jv41aa04j6?svg=true)](https://ci.appveyor.com/project/interpretor/zyre-js)
[![codecov](https://codecov.io/gh/interpretor/zyre.js/branch/master/graph/badge.svg)](https://codecov.io/gh/interpretor/zyre.js)

Node.js port of [Zyre](https://github.com/zeromq/zyre) - an open-source framework for proximity-based peer-to-peer applications

## Description

Zyre.js provides peer discovery and reliable (group) messaging over local area networks. Some of the key features:

- Zyre.js works without administration or configuration
- Peers can join or leave the network at any time
- Peers can communicate directly with each other; no central server or message broker needed
- Peers can join groups
- Zyre.js loses no message, even when the network is under heavy load
- Zyre.js is designed to be used in WiFi networks (but can also be used in Ethernet networks)
- Peer discovery usually takes less than a second

Zyre.js implements the [ZRE](https://rfc.zeromq.org/spec:36/ZRE/) protocol.

## Installation

```bash
npm install zyre.js
```

## Documentation

A full jsdoc documentation can be found [here](https://interpretor.github.io/zyre.js/).

The public API contains the following:

```js
const zyre = require('zyre.js');

// Create a new zyre.js instance (arguments are optional)
const z1 = zyre.new({
  name: 'foo',      // Name of the zyre node
  iface: 'eth0',    // Network interface
  headers: {        // Headers will be sent on every new connection
    foo: 'bar',
  },
  evasive: 5000,    // Timeout after which the local node will try to ping a not responding peer
  expired: 30000,   // Timeout after which a not responding peer gets disconnected
  bport: 5670,      // Discovery beacon broadcast port
  binterval: 1000,  // Discovery beacon broadcast interval
});

// Starts up the zyre.js instance. Async function, so you can register...
z1.start(() => {
  // ...a callback or
}).then(() => {
  // ...a Promise
});

// Stops the zyre.js instance. Async function, so you can register...
z1.stop(() => {
  // ...a callback or
}).then(() => {
  // ...a Promise
});

// Sends a private message to the peer with the given identity
z1.whisper(identity, message);

// Sends a message to the group with the given name
z1.shout(group, message);

// Joins the group with the given name
z1.join(group);

// Leaves the group with the given name
z1.leave(group);

// Returns the identity of the local node
z1.getIdentity();

// Returns information of the connected peer with the given identity
z1.getPeer(identity);

// Returns information of all connected peers
z1.getPeers();

// Returns information of the group with the given name
z1.getGroup(name);

// Returns information of all known groups
z1.getGroups();

// Connect is fired when a new peer joins the network
z1.on('connect', (id, name, headers) => {
  // ...
});

// Disconnect is fired when a peer disconnects from the network
z1.on('disconnect', (id, name) => {
  // ...
});

// Expired is fired when a peer timed out (uses expired timeout value)
z1.on('expired', (id, name) => {
  // ...
});

// Whisper is fired when a peer sends a private message
z1.on('whisper', (id, name, message) => {
  // ...
});

// Shout is fired when a peer sends a group message
z1.on('shout', (id, name, message, group) => {
  // ...
});

// Join is fired when a peer joins a group
z1.on('join', (id, name, group) => {
  // ...
});

// Leave is fired when a peer leaves a group
z1.on('leave', (id, name, group) => {
  // ...
});
```

## Examples

There is a sample chat package that can be found [here](https://github.com/interpretor/zyre-chat).

Inline example of two nodes talking to each other:

```js
const zyre = require('zyre.js');

const z1 = zyre.new({ name: 'z1' });
const z2 = zyre.new({ name: 'z2' });

z1.on('shout', (id, name, message, group) => {
  console.log(`#${group} <${name}> ${message}`);
});

z2.on('shout', (id, name, message, group) => {
  console.log(`#${group} <${name}> ${message}`);
  z2.shout('CHAT', 'Hey!');
});

z1.start().then(() => {
  z1.join('CHAT');
  z2.start().then(() => {
    z2.join('CHAT');
  });
});

setInterval(() => {
  z1.shout('CHAT', 'Hello World!');
}, 1000);
```
