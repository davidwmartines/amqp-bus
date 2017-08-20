'use strict';
const Promise = require('bluebird');

const consumeQueueOptions = {
  exclusive: true,
  autoDelete: true
};

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
      durable: true,
      autoDelete: false
    }).tap(() => {
      bus.emit('debug', `asserted topic exchange ${options.exchangeName}`);
    });
  }

  function assertExclusiveQueue() {
    const queueName = '';
    return channel.assertQueue(queueName, consumeQueueOptions)
      .tap((q) => {
        bus.emit('debug', `asserted queue ${q.queue}`);
      });
  }

  function bindQueue(q) {
    return channel.bindQueue(q.queue, options.exchangeName, options.routingKey)
      .then(() => {
        return q;
      })
      .tap(() => {
        bus.emit('debug', `bound queue ${q.queue}, ${options.routingKey}`);
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
    }).tap((consumeReply) => {
      bus.emit('debug', `started consumer ${q.queue}, ${options.routingKey}, ${consumeReply.consumerTag}`);
    }).then((consumeReply) => {
      return consumeReply.consumerTag;
    });
  }

  function returnSubscription(consumerTag) {
    return Promise.resolve({
      exchangeName: options.exchangeName,
      routingKey: options.routingKey,
      channel: channel,
      consumerTag: consumerTag
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

  bus.emit('debug', `removing topic subscription: ${subscription.routingKey}`);

  return subscription.channel.cancel(subscription.consumerTag)
    .tap(function () {
      bus.emit('debug', `cancelled consumer ${subscription.consumerTag}`);
    })
    .finally(() => {
      return subscription.channel.close();
    });
};