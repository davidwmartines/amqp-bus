'use strict';
const Promise = require('bluebird');

module.exports.registerListener = (bus, options, cb) => {

  if (!bus) {
    throw new Error('bus instance required');
  }
  if (!options) {
    throw new Error('options object required');
  }
  if ((!cb) || (typeof cb !== 'function')) {
    throw new Error('callback function required');
  }

  bus.emit('info', `registering topic listener: ${options.routingKey}`);

  let channel;
  return bus.getConsumerChannel().then(function (c) {
    channel = c;
    return assertTopicExchange()
      .then(assertExclusiveQueue)
      .then(bindQueue)
      .then(consume)
      .then(returnListener);
  });

  function assertTopicExchange() {
    return channel.assertExchange(options.exchangeName, 'topic', {
      durable: false,
      autoDelete: false
    }).tap(() => {
      bus.emit('debug', 'asserted topic exchange ' + options.exchangeName);
    });
  }

  function assertExclusiveQueue() {
    const queueName = '';
    return channel.assertQueue(queueName, {
      exclusive: true
    }).tap((q) => {
      bus.emit('debug', 'asserted queue ' + q.queue);
    });
  }

  function bindQueue(q) {
    return channel.bindQueue(q.queue, options.exchangeName, options.routingKey)
      .then(() => {
        return q;
      })
      .tap(() => {
        bus.emit('debug', 'bound queue ' + q.queue + ', ' + options.routingKey);
      });
  }

  function consume(q) {
    return channel.consume(q.queue, (message) => {
      if (message && message.content) {
        bus.emit('debug', `received message by ${options.routingKey}`);
        channel.ack(message);
        const content = JSON.parse(message.content.toString('utf8'));
        cb(content);
      }
    }).then(() => {
      return q;
    }).tap(() => {
      bus.emit('debug', `started consumer ${q.queue}, ${ options.routingKey}`);
    });
  }

  function returnListener(q) {
    return Promise.resolve({
      exchangeName: options.exchangeName,
      routingKey: options.routingKey,
      channel: channel,
      queue: q.queue
    }).tap(() => {
      bus.emit('info', `registered listener ${options.routingKey}`);
    });
  }

};

module.exports.removeListener = function (bus, listener) {
  if (!bus) {
    throw new Error('bus instance required');
  }
  if (!listener) {
    throw new Error('listener object required');
  }

  bus.emit('debug', `removing topic listener: ${ listener.routingKey}`);

  return listener.channel.checkQueue(listener.queue)
    .then( (q)=> {
      if (q) {
        return listener.channel.unbindQueue(listener.queue, listener.exchangeName, listener.routingKey)
          .tap(function () {
            bus.emit('debug', `unbound queue ${listener.queue}`);
          })
          .then(function () {
            return listener.channel.deleteQueue(listener.queue)
              .tap(function () {
                bus.emit('debug', `deleted queue ${listener.queue}`);
              });
          });
      }
    }).finally(function () {
      return listener.channel.close()
        .tap(function () {
          bus.emit('debug', `closed channel ${listener.routingKey}`);
        });
    }).tap(function () {
      bus.emit('info', `removed topic listener ${ listener.routingKey}`);
    });
};