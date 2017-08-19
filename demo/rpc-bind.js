'use strict';
const Bus = require('../lib/bus');

const bus = new Bus({
  host: '192.168.56.1',
  vhost: 'bus-demo',
  username: 'david',
  password: 'david'
});

const messageType = 'bus.demo.query';

bus.on('started', function () {
  console.log('*** Bus started ***');
  startHandler()
    .tap(() => {
      console.log(`You may now call the "${messageType}" exchange and receive a reply.`);
    })
    .catch((err) => {
      console.error(err);
    });
});

bus.on('stopped', (status) => {
  console.log('XXX Bus stopped XXX', status);
});

bus.on('debug', (msg) => {
  console.log('bus [DEBUG] ' + msg);
});

bus.on('error', (err) => {
  console.log('bus [ERROR] ' + err);
});

bus.on('info', (msg) => {
  console.log('bus [INFO] ', msg);
});

bus.start();

const handleRequest = (message) => {
  console.log('handling', message);
  return {
    result: 'pong'
  };
  //or return a promise..
};

function startHandler() {
  return bus.bind(messageType, handleRequest);
}