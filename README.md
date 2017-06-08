# zyre.js

[![Build Status](https://travis-ci.org/interpretor/zyre.js.svg?branch=master)](https://travis-ci.org/interpretor/zyre.js)
[![Build status](https://ci.appveyor.com/api/projects/status/plddo0jv41aa04j6?svg=true)](https://ci.appveyor.com/project/interpretor/zyre-js)

Node.js port of [Zyre](https://github.com/zeromq/zyre) - an open-source framework for proximity-based peer-to-peer applications

## Notice

This project is currently in development and not considered stable yet.

## Installation

```bash
npm install zyre.js
```

## Documentation

A jsdoc documentation can be found [here](https://interpretor.github.io/zyre.js/).

## Examples

There is a sample chat package, that can be found [here](https://github.com/interpretor/zyre-chat).

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
