'use strict';
const Bus = require('../lib/bus');
const Promise = require('bluebird');
const busConfig = require('./bus-config');

const messageCount = 5;

const bus = new Bus(busConfig);

const publishOptions = {
  exchangeName: 'bus-demo-notifications',
  routingKey: 'notifications.user.1234'
};

bus.on('started', function () {
  console.log('*** Bus started ***');
  sendMessages()
    .then(()=> {
      console.log(`Sent ${messageCount} messages.`);
      console.log(`If you had a queue bound to the "${publishOptions.exchangeName}" exchange using routing key "${publishOptions.routingKey}", you could retrieve the messages there.`);
    })
    .catch((err) => {
      console.error(err);
    })
    .finally(()=> {
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

function sendMessages() {

  const requests = [];

  const send = (i) => {
    const message = {
      description: `Hi from amqp-bus! This is test message ${i}.`
    };
    console.log(`sending message ${i}...`);
    return bus.publish(message, publishOptions);
  };

  for (let i = 1; i <= messageCount; i++) {
    requests.push(send(i));
  }

  return Promise.all(requests);
}