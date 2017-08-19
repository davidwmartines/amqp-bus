# amqp-bus
Bus-like facade over AMQP for simple messaging patterns.

### Basic Usage

**Bus**

A bus object manages the connections, channels, reconnection/disconnection logic.  The creating and deleting of exchanges and queues is also handled automatically.

```javascript
const Bus = require('amqp-bus');

// Create a bus instance. 
// By default connection will be to guest:guest@localhost.
// See docs for options (host, vhost, credentials, etc.)
const bus = new Bus();

// start the bus.  This creates the connection, among other things.
bus.start();

// When bus is started, you can use it.
bus.on('started', ()=> {

  //do stuff with the bus...
  
});

```

Bus has seven functions:
* start
* stop
* publish
* subscribe
* unsubscribe
* call
* bind

### Depending on the role of the application, you can do various things with the bus.
  
  
**As a subscriber:**

Subscribe to a named message type that could be published, such as 'user.created', supplying a handler function to process the received messages.

```javascript

const subscriptionOptions = {
  messageType: 'user.created'
};
bus.subscribe(subscribeOptions, (message) => {
  // message is the JSON object that was published.
  // do something with message...
});
```


**As a message type publisher:**

Broadcast a message to any/all subscribers.

```javascript
const userCreatedEvent = {
  id: 42
  name 'john'
};

const publishOptions = {
  messageType: 'user.created'
};

bus.publish(publishOptions, userCreatedEvent);
 ```


 **As a topic publisher:**
 
Publish using a known exchange and routing key, to route message to specific consumer(s).
```javascript

const publishOptions = {
  exchangeName: 'user.notifications',
  routingKey: 'notifications.user.42'
};

const message = {
  notification : 'something cool happend'
};

  bus.publish(publishOptions, message);
```


**As a topic subscriber:**

Subscribe to messages from a known exchange with a specific routing key, or key pattern.

```javascript
const subscriptionOptions = {
  exchangeName: 'user.notifications',
  routingKey: 'notifications.user.42'
};

const handler = (message) => {
  // do something with received messages.
};

let subscription;
bus.subscribe(subscriptionOptions, handler)
  .then((result) => {
    subscription = result
  });

//later, you can unsubscribe to stop receiving messages and clean up.
bus.unsubscribe(subscription);
```
Note: the unsubscribe can also be used with the messageType subscriptions, but may not be as useful.
  

**As an RPC callee:**

Bind a handler function to a message type.  The return value of the handler will be sent back to caller as the reply.

```javascript
const handleRequest = (message) => {
  return {
    id: 42,
    name: 'john'
  };
  // You may also return a promise, and the resolved value will be sent as the reply.
};

bus.bind('user.query.by-id', handler);
```


**As an RPC caller:**

Call with a message type and receive the reply in a promise.

```javascript
const message = {
  id: 42
};
bus.call('user.query.by-id', message)
  .then((reply) => {
     // do something with the reply...
  });
    
```


Stopping the bus:
```javascript
// later, to clean up and disconnect:
bus.stop();
```

### API docs
coming soon
