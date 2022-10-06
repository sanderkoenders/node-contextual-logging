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

  const log = (level: string, logObj: ILogObj) => {
    const timeStamp = new Date().toISOString();

    transport.log(
      JSON.stringify(
        {
          timeStamp,
          level,
          ...asyncLocalStorage.getStore(),
          ...logObj,
        },
        null,
        1
      )
    );
  };

  return {
    init: (context: IContext, callback: () => void) => {
      asyncLocalStorage.run(context, () => {
        callback();
      });
    },

    debug: (logObj: ILogObj) => log('DEBUG', logObj),

    log: (logObj: ILogObj) => log('LOG', logObj),

    info: (logObj: ILogObj) => log('INFO', logObj),

    warn: (logObj: ILogObj) => log('WARN', logObj),

    error: (logObj: ILogObj) => log('ERROR', logObj),
  };
};

export const loggingContext = LoggingContext(console);
