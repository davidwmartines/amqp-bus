'use strict';
const uuid = require('uuid');
const Promise = require('bluebird');
const shortid = require('shortid');
const publish = require('./publish');

/**
 * Makes an RPC call to a service that is using a compatible bus to respond.
 * Uses unique message-type names to route to consumers.
 */
module.exports = (bus, message, options) => {
  if (!bus) {
    throw new Error('bus instance required');
  }
  if (!message) {
    throw new Error('message object required');
  }
  if (!options) {
    throw new Error('options object required');
  }
  if (!options.messageType) {
    throw new Error('options.messageType required');
  }

  const {
    messageType
  } = options;
  let replyExchangeName;
  let replyQueueName;
  replyExchangeName = replyQueueName = (bus.clientPrefix + messageType) + '-' + shortid.generate();
  const correlationId = uuid.v1();
  const resolver = Promise.defer();
  let consumerChannel;

  bus.getConsumerChannel().then(function (channel) {
    consumerChannel = channel;
    assertReplyExchange()
      .then(assertReplyQueue)
      .then(bindReplyQueue)
      .then(consume)
      .then(send);
  });

  const timeoutMs = options.rpcTimeout || bus.rpcTimeout;
  return resolver.promise.timeout(timeoutMs, `Timed out waiting for response to ${messageType} (${timeoutMs}  ms).`)
    .finally(function () {
      if (consumerChannel) {
        bus.emit('debug', 'closing consumer channel');
        consumerChannel.close();
      }
    });

  function assertReplyExchange() {
    return consumerChannel.assertExchange(replyExchangeName, 'fanout', {
      durable: false,
      autoDelete: true
    }).tap(() => {
      bus.emit('debug', `asserted reply exchange ${replyExchangeName}`);
    });
  }

  function assertReplyQueue() {
    return consumerChannel.assertQueue(replyQueueName, {
      durable: false,
      autoDelete: true,
      exclusive: true
    }).tap(() => {
      bus.emit('debug', `asserted reply queue ${replyQueueName}`);
    });
  }

  function bindReplyQueue() {
    return consumerChannel.bindQueue(replyQueueName, replyExchangeName, '')
      .tap(() => {
        bus.emit('debug', `bound reply queue ${replyQueueName}`);
      });
  }

  function consume() {
    return consumerChannel.consume(replyQueueName, (reply) => {
      bus.emit('debug', 'consuming reply message');
      if (reply) {
        console.log('reply.properties', reply.properties);
        if (reply.properties.correlationId === correlationId) {
          if (reply.content) {
            bus.emit('debug', 'acking');
            const content = JSON.parse(reply.content.toString('utf8'));
            resolver.resolve(content);
          }
          resolver.resolve();
        }
      }
    }, {
      noAck: true
    }).tap(() => {
      bus.emit('debug', `started consumer ${replyQueueName}`);
    });
  }

  function send() {
    return publish(bus, message, {
      exchangeName: messageType,
      exchangeType: 'fanout',
      exchangeOptions: {
        durable: true
      },
      publishOptions: {
        correlationId: correlationId,
        replyTo: replyExchangeName
      },
    });
  }
};