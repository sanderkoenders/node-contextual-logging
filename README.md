# Node contextual logging

## Introduction

Nowadays we are moving away from hosting environments that we are in charge off in favour of serverless alternatives. These serverless alternatives often go hand in hand with NodeJS. When constructing a large application for a large group of users we must've all encountered the problem where logging messages are all over the place with little to no way of determining which log messages should be grouped together. This problem is present in a lot of programming languages across a lot of different stacks with each their own solution. But what about NodeJS?

## The problem

NodeJS is a single threaded runtime for JavaScript. This means that NodeJS cannot take advantage of threads to determine which context belongs to a certain request. Request specific context can be very useful for logging because it allows us to assign a unique id to a request. With that it is possible to easily view all logging messages related to a specific request in a synchonous way thereby making debugging significantly easier. So how to we solve this in NodeJS? Enter Async Hooks!

## What is Async-hooks?

NodeJS is a runtime that heavily relies on asynchronous calls. Almost everything inside NodeJS is asynchronous. The use of promises and timeouts for example. The eventloop is in charge of handling these asynchronous resources. the async hooks module provides an API to track these asynchronous resources. This API allows us to keep track of which asynchronous resource is is associated with a request.

## How to use it

In this example we will be using `AsyncLocalStorage` (a little abstraction on top of `async_hooks`). `AsyncLocalStorage` allows us to create a storage for each request with little to no effort. The example used in the NodeJS documentation explains this quite well.

```javascript
import http from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();

function logWithId(msg) {
  const id = asyncLocalStorage.getStore();
  console.log(`${id !== undefined ? id : '-'}:`, msg);
}

let idSeq = 0;
http
  .createServer((req, res) => {
    asyncLocalStorage.run(idSeq++, () => {
      logWithId('start');
      // Imagine any chain of async operations here
      setImmediate(() => {
        logWithId('finish');
        res.end();
      });
    });
  })
  .listen(8080);

http.get('http://localhost:8080');
http.get('http://localhost:8080');
// Prints:
//   0: start
//   1: start
//   0: finish
//   1: finish
```

The example above explains how two clients connect to the same Node HTTP server. Each request is run within a `asyncLocalStorage.run(...)`. The context is initialized with an `id` (generated with `idSeq`) and this `id` is then used in every `logWithId` call ("start" and "finish"). When you take a look at the result you can see that each request prints "start" and "finish" with their own assigned request id. This demonstrates how to keep track of each request within an application that is visited by multiple clients at the same time.

So how do we incorporate this in our own application and take it to the next level? Let's create a little `express` application written in TypeScript to demonstrate how we can use this in the real world. The first thing we have to do is create a `LoggingContext`.

```typescript
export interface IContext {
  requestId: string;
  traceId: string;
  ipAddress: string;
}

const LoggingContext = () => {
  const asyncLocalStorage = new AsyncLocalStorage<IContext>();

  return {
    init: (context: IContext, callback: () => void) => {
      asyncLocalStorage.run(context, () => {
        callback();
      });
    }
  };
};

export loggingContext = LoggingContext();
```

We create a method called `LoggingContext`. This is essentially a wrapper around the creation of our `AsyncLocalStorage` and returns an object with methods we want to expose to our users. The `init` methode initializes the context for each request and calls a `callback` function when the initialization has completed. The context is initialized with an object that conforms to `IContext` and contains a `requestId`, `traceId` and the `ipAddress` from where the request was send. We can now create a simple express application that uses this `LoggingContext`

```typescript
const app = express();

app.use((req, res, next) => {
  const requestId = uuidv4();
  const traceId = (req.headers['x-trace-id'] ?? requestId) as string;
  const ipAddress = (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '') as string;

  const context = {
    requestId,
    traceId,
    ipAddress,
  };

  loggingContext.init(context, next);
});

app.get('/', (req, res) => {
  res.send('ok');
});
```

I had to use the typescript `as` statement to instruct the compiler that `traceId` and `ipAddress` are of type string. In a production application you would perform a more robust check on these variables but to keep this example simple I chose to do it like this. In the above example we can see the creation of an express application. This application uses the `app.use(...)` to define a middleware that is run on every request. The `next` statement allows us to continue to the next middleware or request handler. We construct a context with `requestId`, `traceId` and `ipAddress` which we then use to call `loggingContext.init`. The `next` function is also passed to `loggingContext.init` and will be executed when the context is initialized. When a request is made to the `/` endpoint `ok` will be returned. Next we will create a `log` method inside our `loggingContext` to log messages to the console.

```typescript
export interface IContext {
  requestId: string;
  traceId: string;
  ipAddress: string;
}

export interface ILogObj {
  operation: string;
  data: Record<string, any>;
}

const LoggingContext = (transport: Pick<Console, 'log'>) => {
  const asyncLocalStorage = new AsyncLocalStorage<IContext>();

  return {
    init: (context: IContext, callback: () => void) => {
      asyncLocalStorage.run(context, () => {
        callback();
      });
    },

    log: (obj: ILogObj) => {
      const timeStamp = new Date().toISOString();

      transport.log({
        timestamp, // Add a timestamp to our log message
        ...asyncLocalStorage.getStore(), // Spread our context with requestId, traceId and ipAddress
        ...logObj // Spread the values of logObj
      })
    }
  };
};

export loggingContext = LoggingContext(console);
```

Three changes were made to the `LoggingContext`. The first change is the addition of `ILogObj`. This interfaces describes the layout of our log message. I choose to add `operation` as a way to describe what action is being performed and `data` to add a `Record` of useful properties that should be in the log message. The second change is the addition of `transport` to the `LoggingContext` method. This is essentially the transport to be used for the log messages. In this case I use `console` to transport the messages to console. The third and last change is the addition of the `log` method which allows us to log `ILogObj` to contole with the request context and timestamp.

Now all we have to do is take advantage of the new `log` method in the express application.

```typescript
const app = express();

app.use((req, res, next) => {
  const requestId = uuidv4();
  const traceId = (req.headers['x-trace-id'] ?? requestId) as string;
  const ipAddress = (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '') as string;

  const context = {
    requestId,
    traceId,
    ipAddress,
  };

  loggingContext.init(context, next);
});

app.get('/', (req, res) => {
  loggingContext.log({
    operation: 'Received request on endpoint',
    data: {
      endpoint: '/',
    },
  });

  const responseMsg = 'ok';

  loggingContext.log(JSON.stringify({
    operation: 'About to send response',
    data: {
      responseMsg,
    }, null, 1),
  });

  res.send(responseMsg);
});

app.listen(port);

http.get('http://localhost:3000');
http.get('http://localhost:3000');

// Output:
// {
//   "timeStamp": "2022-10-10T15:30:47.887Z",
//   "level": "LOG",
//   "requestId": "3ce652e0-b771-43fd-9eda-2ed0f581ba46",
//   "traceId": "3ce652e0-b771-43fd-9eda-2ed0f581ba46",
//   "ipAddress": "127.0.0.1",
//   "operation": "Received request on endpoint",
//   "data": {
//     "endpoint": "/"
//   }
// }
// {
//   "timeStamp": "2022-10-10T15:30:47.891Z",
//   "level": "LOG",
//   "requestId": "8ae509ee-e806-4b09-b5c7-ab2c018fc95f",
//   "traceId": "8ae509ee-e806-4b09-b5c7-ab2c018fc95f",
//   "ipAddress": "127.0.0.1",
//   "operation": "Received request on endpoint",
//   "data": {
//     "endpoint": "/"
//   }
// }
// {
//   "timeStamp": "2022-10-10T15:30:47.887Z",
//   "level": "LOG",
//   "requestId": "3ce652e0-b771-43fd-9eda-2ed0f581ba46",
//   "traceId": "3ce652e0-b771-43fd-9eda-2ed0f581ba46",
//   "ipAddress": "127.0.0.1",
//   "operation": "About to send response",
//   "data": {
//     "responseMsg": "ok"
//   }
// }
// {
//   "timeStamp": "2022-10-10T15:30:47.891Z",
//   "level": "LOG",
//   "requestId": "8ae509ee-e806-4b09-b5c7-ab2c018fc95f",
//   "traceId": "8ae509ee-e806-4b09-b5c7-ab2c018fc95f",
//   "ipAddress": "127.0.0.1",
//   "operation": "About to send response",
//   "data": {
//     "responseMsg": "ok"
//   }
// }
```

Note how each request got its own `requestId` and `traceId` assigned even though the requests were handled at the same time. We now created a great way to keep track of the log messages scoped to a request.

## Tracing requests across multiple services

So now that we created a way to trace our requests within our application how do we go about tracing our requests across multiple services? Remember the `traceId` we added to our context? We can also use `traceId` to trace our requests across multiple services. How? Simply by passing them along with our outgoing requests! Let's use axios and add an axios interceptor to our application.

```typescript
const port = 3000;
const app = express();

axios.interceptors.request.use((config: AxiosRequestConfig) => {
  config.headers = config.headers ?? {};

  config.headers['x-trace-id'] = loggingContext.getTraceId();

  return config;
});

app.use((req, res, next) => {
  const requestId = uuidv4();
  const traceId = (req.headers['x-trace-id'] ?? requestId) as string;
  const ipAddress = (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '') as string;

  const context = {
    requestId,
    traceId,
    ipAddress,
  };

  loggingContext.init(context, next);
});

app.get('/', async (req, res) => {
  const config: AxiosRequestConfig = {
    method: 'GET',
    url: `http://127.0.0.1:${port}/hello`,
  };

  loggingContext.log({
    operation: 'Performing Axios request',
    data: {
      config,
    },
  });

  axios
    .request(config)
    .then((res) => res.data)
    .then(res.send);
});

app.get('/hello', (req, res) => {
  const responseObj = {
    hello: 'World',
  };

  loggingContext.log({
    operation: 'About to send response',
    data: {
      endpoint: '/hello',
      responseObj,
    },
  });

  res.send(responseObj);
});

app.listen(port);

http.get('http://localhost:3000');
http.get('http://localhost:3000');

// Output:
// {
//   "timeStamp": "2022-10-10T16:01:02.843Z",
//   "requestId": "82c12c4c-57b2-413a-a94e-a1be6c1de693",
//   "traceId": "82c12c4c-57b2-413a-a94e-a1be6c1de693",
//   "ipAddress": "127.0.0.1",
//   "operation": "Performing Axios request",
//   "data": {
//     "config": {
//     "method": "GET",
//     "url": "http://127.0.0.1:3000/hello"
//     }
//  }
// }
// {
//   "timeStamp": "2022-10-10T16:01:02.851Z",
//   "requestId": "294d8a9d-02a4-40f8-83dc-89a1769adeeb",
//   "traceId": "294d8a9d-02a4-40f8-83dc-89a1769adeeb",
//   "ipAddress": "127.0.0.1",
//   "operation": "Performing Axios request",
//   "data": {
//     "config": {
//     "method": "GET",
//     "url": "http://127.0.0.1:3000/hello"
//     }
//   }
// }
// {
//   "timeStamp": "2022-10-10T16:01:02.853Z",
//   "requestId": "6a058dc8-fe15-4270-93e8-5f3e0622f3bd",
//   "traceId": "82c12c4c-57b2-413a-a94e-a1be6c1de693",
//   "ipAddress": "127.0.0.1",
//   "operation": "About to send response",
//   "data": {
//     "endpoint": "/hello",
//     "responseObj": {
//     "hello": "World"
//     }
//   }
// }
// {
//   "timeStamp": "2022-10-10T16:01:02.857Z",
//   "requestId": "e59ec69a-c617-4350-85b5-7e8329e7ac0b",
//   "traceId": "294d8a9d-02a4-40f8-83dc-89a1769adeeb",
//   "ipAddress": "127.0.0.1",
//   "operation": "About to send response",
//   "data": {
//     "endpoint": "/hello",
//     "responseObj": {
//     "hello": "World"
//     }
//   }
// }
```

In the example above we added a axios interceptor, this interceptor uses the `getTraceId` method on `loggingContext` to get the `traceId` the context was initialized with. Whenever a request is send with Axios the interceptor is executed and `x-trace-id` is added to our request. The middleware we already had then ensures the `x-trace-id` is used in the `loggingContext`. The above example uses axios to send a request to `/hello` and you can see in the result that for each request the `requestId` changes but the different clients can still be traced through `traceId`.

# Conclusion

The introduction of the `async_hooks` module in NodeJS provided us with a great way to trace calls through the callstack in NodeJS. This helps us identify which log messages are associated with which request. This is a great solution to trace log messages throughout your environment without a lot of complexity or overhead.
