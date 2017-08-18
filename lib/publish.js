'use strict';
const Promise = require('bluebird');

const defaultPublishOptions = {
  contentType: 'application/json',
};


module.exports = (bus, message, options) => {

  let publishChannel;

  const publishOptions = Object.assign({}, defaultPublishOptions, options.publishOptions);

  return bus.getPublishChannel()
    .then((channel) => {
      publishChannel = channel;
      return assertPublishExchange()
        .then(publish);
    });

  function assertPublishExchange() {
    return publishChannel.assertExchange(options.exchangeName, options.exchangeType, options.exchangeOptions)
      .tap(() => {
        bus.emit('debug', `asserted ${options.exchangeType} exchange ${options.exchangeName}`);
      });
  }

  function publish() {
    return new Promise((resolve, reject) => {
      try {
        bus.emit('debug', `publishing to ${options.exchangeName} ${options.routingKey || ''}`);
        const content = new Buffer(JSON.stringify(message));
        const written = publishChannel.publish(options.exchangeName, options.routingKey || '', content, publishOptions, (err)=> {
          if(err){
            return reject(err);
          }
          if (written) {
            return resolve();
          }
          publishChannel.once('drain', () => {
            return resolve();
          });
        });
       
      } catch (err) {
        return reject(err);
      }
    });

  }

};