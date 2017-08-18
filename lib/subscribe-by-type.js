'use strict';
const Promise = require('bluebird');
const shortid = require('shortid');

const messageTypeExchangeType = 'fanout';
const consumeExchangeType = 'fanout';

const messageTypeExchangeOptions = {
  durable: true,
  autoDelete: false
};

const consumeExchangeOptions = {
  durable: true,
  autoDelete: false
};

const defaultConsumeQueueOptions = {
  durable: true,
  autoDelete: false
};

/**
 * Sets up a consumer of message types, via Fanout exhanges.
 */
module.exports.subscribe = (bus, subscriptionRequest, cb) => {

  if (!bus) {
    throw new Error('bus instance required');
  }
  if (!subscriptionRequest) {
    throw new Error('subscriptionRequest object required');
  }
  if (!subscriptionRequest.messageType) {
    throw new Error('subscription.messageType required');
  }
  if ((!cb) || (typeof cb !== 'function')) {
    throw new Error('callback function required');
  }

  bus.emit('info', 'subscribing to ' + subscriptionRequest.messageType);

  const messageTypeExchangeName = subscriptionRequest.messageType;

  const nodePrefix = 'node_' + subscriptionRequest.messageType
    .replace(':', '.')
    .replace(/\./g, '_');

  const consumeExchangeName = `${nodePrefix}_consumer`;

  let consumeQueueName = `${nodePrefix}_consumer_queue`;
  if (!subscriptionRequest.roundRobinConsumer) {
    const consumerNodeId = subscriptionRequest.consumerNodeId || shortid.generate();
    consumeQueueName += `_${consumerNodeId}`;
  }

  const consumeQueueOptions = Object.assign({}, defaultConsumeQueueOptions);
  if(!subscriptionRequest.roundRobinConsumer && ! subscriptionRequest.consumerNodeId){
    consumeQueueOptions.autoDelete = true;
    consumeQueueOptions.durable = false;
  }

  let consumerChannel;

  return bus.getConsumerChannel()
    .then((channel) => {
      consumerChannel = channel;
      return assertMessageTypeExchange()
        .then(assertConsumeExchange)
        .then(bindConsumeExchange)
        .then(assertConsumeQueue)
        .then(bindConsumeQueue)
        .then(consume)
        .then(returnSubscription);
    });

  function returnSubscription(consumingReply) {
    return Promise.resolve({
      messageType: subscriptionRequest.messageType,
      consumerTag: consumingReply.consumerTag,
      channel: consumerChannel
    }).tap(() => {
      bus.emit('info', `subscribed to ${subscriptionRequest.messageType}`);
    });
  }

  function assertMessageTypeExchange() {
    return consumerChannel.assertExchange(messageTypeExchangeName, messageTypeExchangeType, messageTypeExchangeOptions)
      .tap(function () {
        bus.emit('debug', `asserted messageType exchange ${messageTypeExchangeName}`);
      });
  }

  function assertConsumeExchange() {
    return consumerChannel.assertExchange(consumeExchangeName, consumeExchangeType, consumeExchangeOptions)
      .tap(function () {
        bus.emit('debug', `asserted consume exchange ${consumeExchangeName}`);
      });
  }

  function bindConsumeExchange() {
    return consumerChannel.bindExchange(consumeExchangeName, messageTypeExchangeName, '')
      .tap(function () {
        bus.emit('debug', `bound consume exchange ${consumeExchangeName}`);
      });
  }

  function assertConsumeQueue() {
    return consumerChannel.assertQueue(consumeQueueName, consumeQueueOptions)
      .tap(function () {
        bus.emit('debug', `asserted consume queue ${consumeQueueName}`);
      });
  }

  function bindConsumeQueue() {
    return consumerChannel.bindQueue(consumeQueueName, consumeExchangeName, '')
      .tap(function () {
        bus.emit('debug', `bound consume queue ${consumeQueueName}`);
      });
  }

  function consume() {
    return consumerChannel.consume(consumeQueueName, function (received) {
      bus.emit('debug', 'consuming message');
      if (received && received.content) {
        bus.emit('debug', 'acking');
        consumerChannel.ack(received);
        const content = JSON.parse(received.content.toString('utf8'));
        cb(content);
      }
    }).tap((consumingReply) => {
      bus.emit('debug', `started consumer ${consumingReply.consumerTag}`);
    });
  }
};

module.exports.unsubscribe = (bus, subscription) => {
  if (!bus) {
    throw new Error('bus instance required');
  }
  if (!subscription) {
    throw new Error('subscription object required');
  }
  bus.emit('debug', `unsubscribing from ${subscription.messageType}, ${subscription.consumerTag}`);
  return subscription.channel.cancel(subscription.consumerTag)
    .tap(function () {
      bus.emit('debug', `cancelled consumer ${subscription.consumerTag}`);
    })
    .finally(() => {
      return subscription.channel.close();
    });
};