'use strict';
const Bus = require('../lib/bus');

const bus = new Bus({
  host: '192.168.56.1',
  vhost: 'bus-demo',
  username: 'david',
  password: 'david'
});

const options = {
  messageType: 'bus.demo.query'
};

bus.on('started', function () {
  console.log('*** Bus started ***');
  console.log('Sending a request.');
  console.log(`If you have an exchange or queue bound to the "${options.messageType}" exchange, you can inspect it there.`);
  console.log('You can then send a reply to the exchange indicated in the "replyTo" property of the message.');
  sendMessage()
    .catch((err) => {
      console.error(err);
    })
    .finally(() => {
      bus.stop();
    });
});

bus.on('stopped', function (status) {
  console.log('XXX Bus stopped XXX', status);
});

bus.on('debug', function (msg) {
  console.log('bus [DEBUG] ' + msg);
});

bus.on('error', function (err) {
  console.log('bus [ERROR] ' + err);
});

bus.on('info', function (msg) {
  console.log('bus [INFO] ', msg);
});

bus.start();

function sendMessage() {

  const message = {
    name: 'test'
  };

  return bus.callRpc(message, options)
    .then((reply) => {
      console.log('got reply', reply);
    })
    .catch((err) => {
      console.error(err);
    });
}