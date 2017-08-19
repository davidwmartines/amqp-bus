# amqp-bus
Bus-like facade over AMQP for simple messaging patterns.

### Usage

```javascript
const Bus = require('amqp-bus');

// Create a bus instance. 
// By default connection will be to guest:guest@localhost.
// See docs for options (host, vhost, credentials, etc.)
const bus = new Bus();

// start the bus.  The creates the connection, among other things.
bus.start();

// When bus is started you can use it.
bus.on('started', ()=> {

  // Depending on the role of the application, you can do various things with the bus.
  
  
  /****************************************
    As a subscriber:
    Subscribe to a named message type that could be published, such as 'user.created',
    supplying a handler function to process the received messages.
  */
  const subscriptionOptions = {
    messageType: 'user.created'
  };
  bus.subscribe(subscribeOptions, (message) => {
    // message is the JSON object that was published.
    // do something with message...
  });
  
  /****************************************
     As a message type publisher:
     Fanout a message to any/all subscribers.
  */
  const userCreatedEvent = {
    id: 42
    name 'john'
  };
  
  const publishOptions = {
    messageType: 'user.created'
  };
  
  bus.publish(publishOptions, userCreatedEvent);
  
  
  /****************************************
     As a topic publisher:
     Publish using a known exchange and routing key,
     to route message to specific consumer(s).
     (Note: exchange creation/deletion is handled automatically.)
  */
  const publishOptions = {
    exchangeName: 'user.notifications',
    routingKey: 'notifications.user.42'
  };
  const message = {
    notification : 'something cool happend'
  };
  
  bus.publish(publishOptions, message);
  
  
  /****************************************
     As a topic subscriber:
     Subscribe to messages from a known exchange 
     with a specific routing key.
     (Note: exchange creation/deletion is handled automatically.)
  */
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
  
  // Note: the unsubscribe can also be used with the messageType subscriptions, but may not be useful.
  
  
  /****************************************
     As an RPC callee:
     Bind a handler function to a message type.
  */
  const handleRequest = (message) => {
    return {
      id: 42,
      name: 'john'
    };
    //or return a promise...
  };
  
  bus.bind('user.query.by-id', handler);
  
  
  /****************************************
     As an RPC caller:
     Call with a message type and receive the reply in a promise
  */
  
  const message = {
    id: 42
  };
  bus.call('user.query.by-id', message)
    .then((response) => {
       // do something with the response
    });
  
  
});


```
