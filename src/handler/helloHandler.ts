import { Request, Response } from 'express';
import { loggingContext } from '../lib/loggingContext';

export const helloHandler = (req: Request, res: Response) => {
  const name = req.params['name'] ?? 'world';

  const responseObj = { hello: name };

  loggingContext.debug({
    operation: 'Sending response',
    data: responseObj,
  });

  res.send(responseObj);
};
