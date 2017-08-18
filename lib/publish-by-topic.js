'use strict';

const exchangeType = 'topic';
const defaultExchangeOptions = {
  durable: true
};
const publishOptions = {
  contentType: 'application/json',
};

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

  let publishChannel;

  return bus.getPublishChannel()
    .then((channel) => {
      publishChannel = channel;
      return assertPublishExchange()
        .then(publish);
    });

  function assertPublishExchange() {
    return publishChannel.assertExchange(options.exchangeName, exchangeType, options.exchangeOptions || defaultExchangeOptions)
      .tap(() => {
        bus.emit('debug', `asserted topic exchange ${options.exchangeName}`);
      });
  }

  function publish() {
    return new Promise((resolve, reject) => {
      try {
        bus.emit('debug', `publishing to ${options.exchangeName} with ${options.routingKey}`);
        const content = new Buffer(JSON.stringify(message));
        const written = publishChannel.publish(options.exchangeName, options.routingKey, content, publishOptions);
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