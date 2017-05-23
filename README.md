# zyre.js

[![Build Status](https://travis-ci.org/interpretor/zyre.js.svg?branch=master)](https://travis-ci.org/interpretor/zyre.js)

Node.js port of [Zyre](https://github.com/zeromq/zyre) - an open-source framework for proximity-based peer-to-peer applications

## Notice

This project is currently in development and not considered stable yet.

## Installation

```bash
npm install zyre.js
```

## Documentation

A jsdoc documentation can be found [here](https://interpretor.github.io/zyre.js/)

## Examples

```js
const zyre = require('zyre.js');

const z1 = zyre.new();
const z2 = zyre.new();

z1.on('message', (name, message, group) => {
  console.log(`#${group} <${name}> ${message}`);
  z1.shout('CHAT', 'Hey!');
});

z2.on('message', (name, message, group) => {
  console.log(`#${group} <${name}> ${message}`);
});

z1.start().then(() => {
  z1.join('CHAT');
  z2.start().then(() => {
    z2.join('CHAT');
  });
});

setInterval(() => {
  z2.shout('CHAT', 'Hello World!');
}, 1000);
```
