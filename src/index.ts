import express from 'express';
import { loggingContext } from './lib/loggingContext';
import { v4 as uuidv4 } from 'uuid';

import http from 'node:http';
import axios, { AxiosRequestConfig } from 'axios';

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
    .then((data) => res.send(data));
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
