import express from 'express';
import { loggingContext } from './lib/loggingContext';
import { v4 as uuidv4 } from 'uuid';

import http from 'node:http';

const port = 3000;
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

  loggingContext.log({
    operation: 'About to send response',
    data: {
      responseMsg,
    },
  });

  res.send(responseMsg);
});

app.listen(port);

http.get('http://localhost:3000');
http.get('http://localhost:3000');
