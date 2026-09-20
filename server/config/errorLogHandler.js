import { formatISO } from 'date-fns'; 
import { logEvents } from './errorLogger.js'; 

const errorLog = (err, req, res, next) => {
  logEvents(`${err?.name} - ${err?.message}: ${req?.url}\t - - [${formatISO(new Date())}] ${req?.method} ${req?.headers?.origin}`, 'error.log');
  console.log(err?.stack); 

  const status = res.statusCode ? res.statusCode : 500 
  res.status(status)
      .json({
        message: err?.message, 
        error: err, 
        isError: true
      }); 
}; 

export default errorLog;