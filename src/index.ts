import express from 'express';
import { rootHandler } from './handler/rootHandler';
import { loggingContext } from './lib/loggingContext';
import { v4 as uuidv4 } from 'uuid';

const port = 3000;
const app = express();

app.use((req, res, next) => {
  const requestId = uuidv4();
  const ipAddress = (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '') as string;

  const context = {
    requestId,
    ipAddress,
  };

  loggingContext.init(context, next);
});

app.get('/', rootHandler);

app.listen(port, () => console.log(`Express server listening on port ${port}`));
