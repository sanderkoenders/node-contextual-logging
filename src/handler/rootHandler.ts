import { Request, Response } from 'express';
import { loggingContext } from '../lib/loggingContext';

export const rootHandler = (req: Request, res: Response) => {
  const responseObj = {
    hello: 'world',
  };

  loggingContext.info({
    operation: 'Sending response',
    data: responseObj,
  });

  res.send(responseObj);
};
