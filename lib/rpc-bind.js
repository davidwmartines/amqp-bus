'use strict';
const Promise = require('bluebird');
const publish = require('./publish');

const consumeExchangeType = 'fanout';
const consumeExchangeOptions = {
  durable: true,
  autoDelete: true
};

const consumeQueueOptions = {
  durable: true,
  autoDelete: true
};

const defaultReplyOptions = {
  exchangeType: 'fanout',
  exchangeOptions: {
    durable: true,
    autoDelete: true
  }
};

const defaultPublishOptions = {};

module.exports = (bus, messageType, handler) => {
  if (!bus) {
    throw new Error('bus instance required');
  }
  if (!messageType) {
    throw new Error('messageType required');
  }
  if ((!handler) || (typeof handler !== 'function')) {
    throw new Error('handler function required');
  }

  bus.emit('info', 'binding to ' + messageType);

  const consumeExchangeName = messageType;
  const consumeQueueName = `${messageType}_handler queue`;

  let consumerChannel;

  return bus.getConsumerChannel()
    .then((channel) => {
      consumerChannel = channel;
      return assertConsumeExchange()
        .then(assertConsumeQueue)
        .then(bindConsumeQueue)
        .then(consume);
    });


  function assertConsumeExchange() {
    return consumerChannel.assertExchange(consumeExchangeName, consumeExchangeType, consumeExchangeOptions)
      .tap(() => {
        bus.emit('debug', `asserted consume exchange ${consumeExchangeName}`);
      });
  }

  function assertConsumeQueue() {
    return consumerChannel.assertQueue(consumeQueueName, consumeQueueOptions)
      .tap(() => {
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
    return consumerChannel.consume(consumeQueueName, receive)
      .tap((consumingReply) => {
        bus.emit('debug', `started consumer ${consumingReply.consumerTag}`);
      });
  }

  function receive(received) {
    bus.emit('debug', 'consuming message');
    if (received && received.content) {
      const content = JSON.parse(received.content.toString('utf8'));
      const publishOptions = Object.assign({}, defaultPublishOptions, {
        correlationId: received.properties.correlationId
      });
      const replyOptions = Object.assign({}, defaultReplyOptions, {
        exchangeName: received.properties.replyTo,
        publishOptions: publishOptions
      });
      bus.emit('debug', 'handling message');
      return Promise.try(() => {
        return Promise.resolve(handler(content))
          .then((reply) => {
            bus.emit('debug', 'replying');
            return publish(bus, reply, replyOptions);
          });
      }).catch((handlerError) => {
        bus.emit('debug', handlerError);
        const errorMessage = {
          error: handlerError
        };
        return publish(bus, errorMessage, replyOptions);
      }).finally(() => {
        bus.emit('debug', 'acking');
        consumerChannel.ack(received);
      });
    }
  }

};