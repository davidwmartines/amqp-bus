'use strict';
const publish = require('./publish');

const exchangeType = 'topic';
const defaultExchangeOptions = {
  durable: true
};

/**
 * Publishes to known topic exchange with specific routing key.
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
  if (!options.exchangeName) {
    throw new Error('options.exchangeName required');
  }
  if (!options.routingKey) {
    throw new Error('options.routingKey required');
  }

  return publish(bus, message, Object.assign({}, {
    exchangeOptions: defaultExchangeOptions,
    exchangeType: exchangeType
  }, options));
};