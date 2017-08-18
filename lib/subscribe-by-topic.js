'use strict';
const Promise = require('bluebird');

/**
 * Sets up a consumer of a known topic exchange using a specific routing key.
 */
module.exports.subscribe = (bus, options, cb) => {

  if (!bus) {
    throw new Error('bus instance required');
  }
  if (!options) {
    throw new Error('options object required');
  }
  if (!options.exchangeName) {
    throw new Error('options.exchangeName required');
  }
  if (!options.routingKey) {
    throw new Error('options.routingKey required');
  }
  if ((!cb) || (typeof cb !== 'function')) {
    throw new Error('callback function required');
  }

  bus.emit('info', `registering topic subscription on exchange ${options.exchangeName} with routing key ${options.routingKey}`);

  let channel;
  return bus.getConsumerChannel().then((c) => {
    channel = c;
    return assertTopicExchange()
      .then(assertExclusiveQueue)
      .then(bindQueue)
      .then(consume)
      .then(returnSubscription);
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

  function returnSubscription(q) {
    return Promise.resolve({
      exchangeName: options.exchangeName,
      routingKey: options.routingKey,
      channel: channel,
      queue: q.queue
    }).tap(() => {
      bus.emit('info', `registered subscription ${options.routingKey}`);
    });
  }

};

module.exports.unsubscribe = function (bus, subscription) {
  if (!bus) {
    throw new Error('bus instance required');
  }
  if (!subscription) {
    throw new Error('subscription object required');
  }

  bus.emit('debug', `removing topic listener: ${ subscription.routingKey}`);

  return subscription.channel.checkQueue(subscription.queue)
    .then((q) => {
      if (q) {
        return subscription.channel.unbindQueue(subscription.queue, subscription.exchangeName, subscription.routingKey)
          .tap(function () {
            bus.emit('debug', `unbound queue ${subscription.queue}`);
          })
          .then(function () {
            return subscription.channel.deleteQueue(subscription.queue)
              .tap(function () {
                bus.emit('debug', `deleted queue ${subscription.queue}`);
              });
          });
      }
    }).finally(function () {
      return subscription.channel.close()
        .tap(function () {
          bus.emit('debug', `closed channel ${subscription.routingKey}`);
        });
    }).tap(function () {
      bus.emit('info', `removed subscription ${ subscription.routingKey}`);
    });
};