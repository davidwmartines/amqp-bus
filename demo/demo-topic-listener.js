'use strict';
const Bus = require('../lib/bus');

const bus = new Bus();

const listenerOptions = {
  exchangeName: 'user-messages',
  routingKey: 'messages.user.1234'
};

bus.on('started', function () {
  console.log('*** Bus started ***');
  startListener()
    .tap(()=> {
      console.log(`You may now publish a message containing a JSON payload to the ${listenerOptions.exchangeName} exchange, with routing key of ${listenerOptions.routingKey}.`);
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

function startListener() {
  
  let listener;
  return bus.registerTopicListener(listenerOptions, (message) => {
    console.log('received message', message);
    bus.removeTopicListener(listener)
      .finally(() => {
        bus.stop();
      });
  }).then((result) => {
    listener = result;
  });
}