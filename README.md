# zyre.js

[![Build Status](https://travis-ci.org/interpretor/zyre.js.svg?branch=master)](https://travis-ci.org/interpretor/zyre.js)
[![Build status](https://ci.appveyor.com/api/projects/status/plddo0jv41aa04j6?svg=true)](https://ci.appveyor.com/project/interpretor/zyre-js)
[![codecov](https://codecov.io/gh/interpretor/zyre.js/branch/master/graph/badge.svg)](https://codecov.io/gh/interpretor/zyre.js)
[![Greenkeeper badge](https://badges.greenkeeper.io/interpretor/zyre.js.svg)](https://greenkeeper.io/)

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

Zyre.js 2.x is currently available as beta, which uses the rewritten zeromq.js 6.x

## Installation

```bash
npm install zyre.js
```

Beta:

```bash
npm install zyre.js@beta
```

## Documentation

A full jsdoc documentation can be found [here](https://interpretor.github.io/zyre.js/).

## Usage

```js
const Zyre = require('zyre.js');
```

Creates a new zyre.js instance (arguments are optional).

```js
const zyre = new Zyre({
  name: 'foo',      // Name of the zyre node
  iface: 'eth0',    // Network interface
  headers: {        // Headers will be sent on every new connection
    foo: 'bar',
  },
  evasive: 5000,    // Timeout after which the local node will try to ping a not responding peer
  expired: 30000,   // Timeout after which a not responding peer gets disconnected
  port: 49152,      // Port for incoming messages, will be incremented if already in use
  bport: 5670,      // Discovery beacon broadcast port
  binterval: 1000,  // Discovery beacon broadcast interval
});
```

Starts up the zyre.js instance. Must be called before any other function.

```js
// Async function, so you can register...
zyre.start(() => {
  // ...a callback or
}).then(() => {
  // ...a Promise
});
```

Stops the zyre.js instance. Deletes all peers data.

```js
// Async function, so you can register...
zyre.stop(() => {
  // ...a callback or
}).then(() => {
  // ...a Promise
});
```

Sends a private message to the peer with the given identity.
The message can be a string or a raw buffer.

```js
zyre.whisper(identity, message);
```

Sends a message to the group with the given name.
The message can be a string or a raw buffer.

```js
zyre.shout(group, message);
```

Joins the group with the given name.

```js
zyre.join(group);
```

Leaves the group with the given name.

```js
zyre.leave(group);
```

Returns the identity of the local node. The identity is a 16 byte UUID as hex string.

```js
zyre.getIdentity();
```

Returns information of the connected peer with the given identity.

```js
zyre.getPeer(identity);
```

Returns information of all connected peers.

```js
zyre.getPeers();
```

Returns information of the group with the given name.

```js
zyre.getGroup(name);
```

Returns information of all known groups.

```js
zyre.getGroups();
```

Sets the encoding of received messages. Defaults to utf8.
Available are: `ascii`, `utf8`, `utf16le`/`ucs2`, `base64`, `binary`, `hex`, `raw`/`null`

```js
zyre.setEncoding('utf8');   // Default encoding
zyre.setEncoding(null);     // Raw buffers
```

Connect is fired when a new peer joins the network.

```js
zyre.on('connect', (id, name, headers) => {
  // ...
});
```

Disconnect is fired when a peer disconnects from the network.

```js
zyre.on('disconnect', (id, name) => {
  // ...
});
```

Expired is fired when a peer timed out. (uses expired timeout value)

```js
zyre.on('expired', (id, name) => {
  // ...
});
```

Whisper is fired when a peer sends a private message.

```js
zyre.on('whisper', (id, name, message) => {
  // ...
});
```

Shout is fired when a peer sends a group message.

```js
zyre.on('shout', (id, name, message, group) => {
  // ...
});
```

Join is fired when a peer joins a group.

```js
zyre.on('join', (id, name, group) => {
  // ...
});
```

Leave is fired when a peer leaves a group.

```js
zyre.on('leave', (id, name, group) => {
  // ...
});
```

## Examples

There is a sample chat package that can be found [here](https://github.com/interpretor/zyre-chat).

Inline example of two nodes talking to each other:

```js
const Zyre = require('zyre.js');

const chris = new Zyre({ name: 'Chris' });
const john = new Zyre({ name: 'John' });

chris.on('connect', () => {
  chris.shout('CHAT', 'Hello World');
});

chris.on('whisper', (id, name, message) => {
  console.log(`${name}: ${message}`);
});

chris.start(() => {
  chris.join('CHAT');
});

john.on('shout', (id, name, message, group) => {
  console.log(`(${group}) ${name}: ${message}`);
  john.whisper(id, `Hello ${name}`);
});

john.start(() => {
  john.join('CHAT');
});
```

Prints:

```bash
(CHAT) Chris: Hello World
John: Hello Chris
```
