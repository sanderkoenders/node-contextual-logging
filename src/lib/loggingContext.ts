import { AsyncLocalStorage } from 'async_hooks';

export interface ILogObj {
  operation: string;
  data: Record<string, any>;
}

export interface IContext {
  requestId: string;
  traceId: string;
  ipAddress: string;
}

const LoggingContext = (transport: Pick<Console, 'log'>) => {
  const asyncLocalStorage = new AsyncLocalStorage<IContext>();

  return {
    init: (context: IContext, callback: () => void) => {
      asyncLocalStorage.run(context, () => {
        callback();
      });
    },

    log: (logObj: ILogObj) => {
      const timeStamp = new Date().toISOString();

      transport.log(
        JSON.stringify(
          {
            timeStamp,
            ...asyncLocalStorage.getStore(),
            ...logObj,
          },
          null,
          1
        )
      );
    },
  };
};

export const loggingContext = LoggingContext(console);
