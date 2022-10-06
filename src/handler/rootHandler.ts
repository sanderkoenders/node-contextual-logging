import { Request, Response } from 'express';
import { loggingContext } from '../lib/loggingContext';
import axios, { AxiosResponse } from 'axios';

const handleError = (res: Response) => (err: any) => {
  loggingContext.error({
    operation: 'Handle error',
    data: err,
  });

  res.status(500).send({
    error: 'something went wrong',
  });
};

const handleSuccess = (res: Response) => (axiosResponse: AxiosResponse) => {
  loggingContext.info({
    operation: 'Sending response',
    data: axiosResponse.data,
  });

  res.send(axiosResponse.data);
};

export const rootHandler = (req: Request, res: Response) => {
  const requestConfig = {
    url: 'http://127.0.0.1:3000/hello',
    method: 'GET',
  };

  loggingContext.info({
    operation: 'Calling axios',
    data: requestConfig,
  });

  axios.request(requestConfig).then(handleSuccess(res)).catch(handleError(res));
};
