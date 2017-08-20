'use strict';
const Bus = require('../lib/bus');

const busConfig = require('./bus-config');

const bus = new Bus(busConfig);

const options = {
  messageType: 'bus.demo.query',
  rpcTimeout: 60000
};

bus.on('started', function () {
  console.log('*** Bus started ***');
  console.log('Sending a request.');
  console.log(`If you have an exchange or queue bound to the "${options.messageType}" exchange, you can inspect it there.`);
  console.log('You can then send a reply to the exchange indicated in the "replyTo" property of the message, including a matching correlation_id property".');
  console.log(`You have ${options.rpcTimeout / 1000} seconds to reply!`);
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
    query: 'ping'
  };
  console.log('sending', message);
  return bus.call(message, options)
    .then((reply) => {
      console.log('received', reply);
    })
    .catch((err) => {
      console.error(err);
    });
}