'use strict';
const amqp = require('amqplib');
const os = require('os');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const rpcCall = require('./rpc-call');
const rpcBind = {};
const publishByType = require('./publish-by-type');
const publishByTopic = require('./publish-by-topic');
const subscribeByType = require('./subscribe-by-type');
const subscribeByTopic = require('./subscribe-by-topic');
const Promise = require('bluebird');

module.exports = Bus;

/**
 * Creates a new Bus instance.
 * @param {object} options {host, [protocol], [username], [password], [vhost], [rpcTimeout], [heartbeat]}
 */
function Bus(options) {
  options = options || {
    host: 'localhost'
  };
  this.options = options;

  this.amqpUri = `${options.protocol || 'amqp'}://${options.username || 'guest'}:${options.password || 'guest'}@${options.host}${options.vhost === '/' ? '' : '/'}${options.vhost || ''}?heartbeat=${options.heartbeat || 5}`;

  this.connection = null;
  this.clientPrefix = 'bus-' + os.hostname() + '-node-' + process.pid + '-';
  this.rpcTimeout = options.rpcTimeout || 30000;
  this.restartInterval = options.restartInterval || 5000;
  this.publishChannel = null;
}

util.inherits(Bus, EventEmitter);

/**
 * Starts the bus.
 */
Bus.prototype.start = function () {
  const bus = this;
  if (bus.connection) {
    return;
  }

  connect();

  function connect() {
    bus.emit('info', `connecting to RabbitMQ ${bus.options.protocol || 'amqp'}://${bus.options.username || 'guest'}:${bus.options.password ? 'xxxxx': null || 'guest'}@${bus.options.host}${(bus.options.vhost === '/' ? '' : '/')}${(bus.options.vhost || '')}`);
    amqp.connect(bus.amqpUri).then((connection) => {
      bus.connection = connection;
      connection.createConfirmChannel().then((channel) => {
        bus.publishChannel = channel;
        bus.emit('started');

        connection.on('error', (err) => {
          bus.emit('error', err);
          tryReconnect();
        });

        connection.on('blocked', (reason) => {
          bus.emit('error', 'blocked ' + reason);
        });

        connection.on('unblocked', () => {
          bus.emit('info', 'RabbitMQ Connection Unblocked');
        });
      });
    }).catch((err) => {
      bus.emit('error', err);
      tryReconnect();
    });
  }

  function tryReconnect() {
    bus.emit('info', `reconnecting in ${bus.restartInterval / 1000} seconds...`);
    setTimeout(connect, bus.restartInterval);
  }
};

/**
 * Stops the bus.
 */
Bus.prototype.stop = function () {
  const bus = this;
  if (bus.connection && bus.publishChannel) {
    bus.publishChannel.waitForConfirms()
      .then(() => {
        close();
      })
      .catch((err) => {
        bus.emit('error', err);
      });
  } else {
    close();
  }

  function close() {
    if (bus.connection) {
      bus.connection.close().then(() => {
        bus.emit('stopped', true);
      });
    } else {
      bus.emit('stopped', false);
    }
  }
};

/**
 * Gets access to a channel for consuming.  (Meant to be used internally.)
 * @return {Promise} A promise resolving to a channel.
 */
Bus.prototype.getConsumerChannel = function () {
  const bus = this;
  if (!bus.connection) {
    throw new Error('Bus must be started before getting consumer channel.');
  }
  return bus.connection.createChannel();
};

/**
 * Gets access to a channel for publishing.  (Meant to be used internally.)
 * @return {Promise} A promise resolving to a channel.
 */
Bus.prototype.getPublishChannel = function () {
  const bus = this;
  if (!bus.connection) {
    throw new Error('Bus must be started before getting publish channel.');
  }
  return Promise.resolve(bus.publishChannel);
};

/**
 * Sends a remote-procedure-call (RPC) request.
 * @param  {object} message   The message body.
 * @param  {object} options   Parameters.
 * @return {promise}          Promise to resolve response message.
 */
Bus.prototype.callRpc = function (message, options) {
  return rpcCall(this, message, options);
};

/**
 * listens for remote-procedure-call (RPC) request.
 * @param  {object} message   The message body.
 * @param  {object} options   Parameters.
 * @param  {function} handler Function to handle incoming messages. Should resolve/return a value.
 * @return {promise}          Promise to resolve response message.
 */
Bus.prototype.bindRpc = function (message, options, handler) {
  return rpcBind(this, message, options, handler);
};

/**
 * Publishes a message.
 * @param  {object} message   The message body.
 * @param  {object} options   Parameters.
 * @return {promise}          Promise to resolve successful send.
 */
Bus.prototype.publish = function (message, options) {
  if (options.routingKey) {
    return publishByTopic(this, message, options);
  } else if (options.messageType) {
    return publishByType(this, message, options);
  } else {
    throw new Error('invalid publish options');
  }
};

/**
 * Starts listening on a subscription.
 * @param  {object}   subscriptionRequest Subscription request object.
 * @param  {Function} cb                  Callback function to be invoked with received messages.
 * @return {promise}                      Promise to resolve a subscription.
 */
Bus.prototype.subscribe = function (subscriptionRequest, cb) {
  if (subscriptionRequest.routingKey) {
    return subscribeByTopic.subscribe(this, subscriptionRequest, cb);
  } else if (subscriptionRequest.messageType) {
    return subscribeByType.subscribe(this, subscriptionRequest, cb);
  } else {
    throw new Error('invalid subscription request.');
  }
};

/**
 * Stops listening on a subscription.
 * @param  {object}   subscription Subscription object previously received from subscribing.
 * @return {promise}               Promise to resolve successful unsubscription.
 */
Bus.prototype.unsubscribe = function (subscription) {
  if (subscription.routingKey) {
    return subscribeByTopic.unsubscribe(this, subscription);
  } else if (subscription.messageType) {
    return subscribeByType.unsubscribe(this, subscription);
  } else {
    throw new Error('invalid subscription.');
  }
};