'use strict';
const amqp = require('amqplib');
const os = require('os');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const rpc = () => {}; //require('./rpc');
const fireAndForget = () => {}; // require('./fire-and-forget');
const subscriber = () => {}; //require('./subscriber');
const topicListener = require('./topic-listener');
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
  // this.rabbitmqUri = 'rabbitmq://' + options.host + ':5672' +
  //   (options.vhost === '/' ? '' : '/') + (options.vhost || '') +
  //   (options.vhost === '/' ? '' : '/');

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
    bus.emit('info', `connecting to RabbitMQ ${(bus.options.username || 'guest')}@ ${bus.options.host} ${(bus.options.vhost === '/' ? '' : '/')}${(bus.options.vhost || '')}`);
    amqp.connect(bus.amqpUri).then((connection) => {
      bus.connection = connection;
      connection.createChannel().then((channel) => {
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
  if (bus.connection) {
    bus.connection.close().then(function () {
      bus.emit('stopped', true);
    });
  } else {
    bus.emit('stopped', false);
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
 * @param  {object} options   Optional parameters.
 * @return {promise}          Promise to resolve response message.
 */
Bus.prototype.call = function (message, options) {
  return rpc(this, message, options);
};

/**
 * Sends a message.
 * @param  {object} message   The message body.
 * @param  {object} options   Optional parameters.
 * @return {promise}          Promise to resolve successful send.
 */
Bus.prototype.send = function (message, options) {
  return fireAndForget(this, message, options);
};

/**
 * Starts listening on a subscription.
 * @param  {object}   subscriptionRequest Subscription request object.
 * @param  {Function} cb                  Callback function to be invoked with received messages.
 * @return {promise}                      Promise to resolve a subscription.
 */
Bus.prototype.subscribe = function (subscriptionRequest, cb) {
  return subscriber.subscribe(this, subscriptionRequest, cb);
};

/**
 * Stops listening on a subscription.
 * @param  {object}   subscription Subscription object previously received from subscribing.
 * @return {promise}               Promise to resolve successful unsubscription.
 */
Bus.prototype.unsubscribe = function (subscription) {
  return subscriber.unsubscribe(this, subscription);
};

/**
 * Starts listening for messages from a topic exchange for a specific routing key.
 * @param  {object}   options Listener options.
 * @param  {Function} cb      Callback function to be invoked with received messages.
 * @return {promise}          Promise to resolve a listener object.
 */
Bus.prototype.registerTopicListener = function (options, cb) {
  return topicListener.registerListener(this, options, cb);
};

/**
 * Stops a perviously started topic listener.
 * @param  {object} listener Listener object previously received from registering.
 * @return {promise}         Promise to resolve success.
 */
Bus.prototype.removeTopicListener = function (listener) {
  return topicListener.removeListener(this, listener);
};