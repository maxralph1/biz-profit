import { existsSync } from 'fs'; 
import { promises as fsPromises } from 'fs'; 
import { join, dirname } from 'path'; 
import { fileURLToPath } from 'url'; 
import { formatISO } from 'date-fns'; 

const __filename = fileURLToPath(import.meta.url); 
const __dirname = dirname(__filename); 

const logEvents = async (message, logFileName) => {
  const logItem = `[${formatISO(new Date())}]\t${message}\n`; 

  try {
    const logDir = join(__dirname, '..', 'logs'); 

    if (!existsSync(logDir)) {
      await fsPromises.mkdir(logDir, { recursive: true });
    }
  } catch (error) {
    console.error('Error writing to log:', error)
  }
}; 

const logger = (req, res, next) => {
  logEvents(`${req?.method}\t${req?.url}\t${req?.headers.origin || 'N/A'}`, 'error.log'); 
  console.log(`${req?.method} ${req?.path}`); 
  next();
}; 

export { logEvents, logger };