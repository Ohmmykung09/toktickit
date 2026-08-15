import cors from 'cors';
import express from 'express';
import { prisma } from './db.js';
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

app.get('/api/categories', async (_request, response, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        id: 'asc'
      },
      select: {
        id: true,
        name: true
      }
    });

    response.status(200).json(categories);
  } catch (error) {
    next(error);
  }
});

app.get('/', (_request, response) => {
  response.status(200).json({
    service: 'TokTickIT API',
    message: 'Project foundation is running'
  });
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(error);
    response.status(500).json({
      error: 'Unable to process the request'
    });
  }
);
