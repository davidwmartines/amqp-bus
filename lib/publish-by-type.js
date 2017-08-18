'use strict';
const publish = require('./publish');

const exchangeType = 'fanout';
const defaultExchangeOptions = {
  durable: true
};

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

  return publish(bus, message, Object.assign({}, {
    exchangeName: options.messageType,
    exchangeType: exchangeType,
    exchangeOptions: defaultExchangeOptions
  }, options));
};