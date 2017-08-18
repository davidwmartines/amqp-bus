'use strict';
const Promise = require('bluebird');

const publishOptions = {
  contentType: 'application/json',
};

const messageTypeExchangeOptions = {
  durable: true
};

const requestExchangeType = 'fanout';

/**
 * Publishes to fanout exchange, named by messageType.
 */
module.exports = function (bus, message, options) {
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

  const messageTypeExchangeName = options.messageType;

  let publishChannel;

  return bus.getPublishChannel()
    .then((channel) => {
      publishChannel = channel;
      return assertMessageTypeExchange()
        .then(publish);
    });

  function assertMessageTypeExchange() {
    return publishChannel.assertExchange(messageTypeExchangeName, requestExchangeType, messageTypeExchangeOptions)
      .tap(() => {
        bus.emit('debug', `asserted request exchange ${messageTypeExchangeName}`);
      });
  }

  function publish() {
    return new Promise((resolve, reject) => {
      try {
        bus.emit('debug', `publishing to ${messageTypeExchangeName}`);
        const content = new Buffer(JSON.stringify(message));
        const written = publishChannel.publish(messageTypeExchangeName, '', content, publishOptions);
        if (written) {
          return resolve();
        }
        publishChannel.once('drain', () => {
          return resolve();
        });
      } catch (err) {
        return reject(err);
      }
    });

  }
};