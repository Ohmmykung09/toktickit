import cors from 'cors';
import express from 'express';
import { env } from './env.js';

export const app = express();

app.use(
  cors({
    origin: env.clientOrigin
  })
);
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'TokTickIT API'
  });
});

app.get('/', (_request, response) => {
  response.status(200).json({
    service: 'TokTickIT API',
    message: 'Project foundation is running'
  });
});
