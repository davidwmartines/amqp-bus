'use strict';
const Bus = require('../lib/bus');

const bus = new Bus({
  host: '192.168.56.1',
  vhost: 'bus-demo',
  username: 'david',
  password: 'david'
});

const subscribeOptions = {
  messageType: 'something.happened',
  roundRobinConsumer: false
};

bus.on('started', function () {
  console.log('*** Bus started ***');
  startSubscriber()
    .tap(() => {
      console.log(`You may now publish a message containing a JSON payload to the "${subscribeOptions.messageType}" exchange.`);
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

function startSubscriber() {
  let subscription;
  return bus.subscribe(subscribeOptions, (message) => {
    console.log('received message', message);
    //for demo, we will now unsubscribe and stop the bus.
    bus.unsubscribe(subscription)
      .finally(() => {
        bus.stop();
      });
  }).then((result) => {
    subscription = result;
  });
}