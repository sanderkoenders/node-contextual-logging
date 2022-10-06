import express from 'express';
import { rootHandler } from './handler/rootHandler';
import { loggingContext } from './lib/loggingContext';
import { v4 as uuidv4 } from 'uuid';
import { helloHandler } from './handler/helloHandler';

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

app.use((req, res, next) => {
  loggingContext.debug({
    operation: 'Routing request',
    data: {
      path: req.path,
      method: req.method,
    },
  });

  next();
});

app.get('/', rootHandler);

app.get('/hello', helloHandler);

app.listen(port, () => console.log(`Express server listening on port ${port}`));
