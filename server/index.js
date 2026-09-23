// import 'dotenv/config'; 
import { loadEnvFile } from 'node:process'; 
loadEnvFile();
import express, { json, urlencoded, static as expressStatic } from 'express'; 
const app = express(); 
import helmet from 'helmet'; 
import morgan from 'morgan'; 
import { rateLimit } from 'express-rate-limit'; 
import { dirname, join } from 'path'; 
import { fileURLToPath } from 'url'; 
const __dirname = dirname(fileURLToPath(import.meta.url)); 
import { createStream } from 'rotating-file-stream'; 
import cookieParser from 'cookie-parser'; 
import cors from 'cors'; 
import errorHandler from './middleware/errorHandler.js'; 
import corsOptions from './config/corsOptions.js'; 
import router from './routes/api.js'; 
const PORT = process.env.PORT || 5000; 

app.use(helmet()); 
app.set('trust proxy', 1);

const IS_TEST = process.env.ENV === 'test';
// console.log(IS_TEST, process.env.ENV, "IS_TEST");

if (!IS_TEST) {
  const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes 
    limit: 1000, // Limit each IP to 1000 requests per 'windoe' (here, per 15 mi uges) 
    standardHeaders: 'draft-8', // Return rate limit info in the `RateLimit-*` headers 
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers 
    ipv6Subnet: 56
  }); 
  app.use(rateLimiter); 
  
  let accessLogStream = createStream('access.log', {
    interval: '1d', // rotate daily 
    path: join(__dirname, 'logs/access')
  }); 
  app.use(morgan(':remote-addr - :remote-user [:date[iso]] ":method :url HTTP/:http-version" :status ":res[content-length] - :response-time ms" "referrer" ":user-agent"', { stream: accessLogStream })); 
}

// 

app.disable('x-powered-by'); 
app.use(json()); 
app.use(urlencoded({ extended: true })); 
app.use(cors(corsOptions));
app.use(cookieParser()); 

app.use('/api/v1', router); 
app.use('/api', expressStatic(join(__dirname, 'views')));
app.use('/', expressStatic(join(__dirname, 'views'))); 

app.use((req, res) => {
  res.status(404); 

  if (req.accepts('html')) {
    res.sendFile(join(__dirname, 'views', '404.ejs'));
  } else if (req.accepts('json')) {
    res.json({ message: '404: Not Found!'});
  } else {
    res.type('txt').send('404: Not Found!')
  }
});

app.use(errorHandler);

if (!IS_TEST) {
  app.listen(PORT, () => {
    console.log(`Connected to server on PORT:${PORT}!`)
  });
}

export default app;