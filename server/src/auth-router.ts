import express from 'express';
import { env } from './env.js';
import {
  AuthError,
  changePassword,
  csrfMatches,
  login,
  logout,
  resolveSession,
  sessionCookieName
} from './auth-service.js';

export const authRouter = express.Router();

const cookieOptions: express.CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.nodeEnv === 'production',
  path: '/',
  maxAge: 8 * 60 * 60 * 1000
};
const clearCookieOptions: express.CookieOptions = {
  httpOnly: cookieOptions.httpOnly,
  sameSite: cookieOptions.sameSite,
  secure: cookieOptions.secure,
  path: cookieOptions.path
};

function cookieValue(request: express.Request) {
  const cookieHeader = request.header('cookie');
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(';')) {
    const [name, ...parts] = item.trim().split('=');
    if (name === sessionCookieName) {
      try {
        return decodeURIComponent(parts.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function sendAuthError(response: express.Response, error: unknown) {
  if (error instanceof AuthError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) }
    });
    return;
  }
  throw error;
}

function approvedOrigin(request: express.Request) {
  return request.header('origin') === env.clientOrigin;
}

function sendSession(response: express.Response, result: Awaited<ReturnType<typeof login>>) {
  response.cookie(sessionCookieName, result.cookieValue, cookieOptions).status(200).json({
    user: result.user,
    mustChangePassword: result.mustChangePassword,
    csrfToken: result.csrfToken
  });
}

authRouter.post('/login', async (request, response, next) => {
  try {
    if (!approvedOrigin(request)) {
      throw new AuthError(403, 'ORIGIN_REJECTED', 'The request origin is not permitted.');
    }
    sendSession(response, await login(request.body?.email, request.body?.password));
  } catch (error) {
    try {
      sendAuthError(response, error);
    } catch (unexpectedError) {
      next(unexpectedError);
    }
  }
});

authRouter.get('/me', async (request, response, next) => {
  try {
    const session = await resolveSession(cookieValue(request));
    if (!session) throw new AuthError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    response.status(200).json({
      user: session.user,
      mustChangePassword: session.mustChangePassword,
      csrfToken: session.csrfToken
    });
  } catch (error) {
    try {
      sendAuthError(response, error);
    } catch (unexpectedError) {
      next(unexpectedError);
    }
  }
});

authRouter.post('/change-password', async (request, response, next) => {
  try {
    const session = await resolveSession(cookieValue(request));
    if (!session) throw new AuthError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    if (!approvedOrigin(request) || !csrfMatches(session, request.header('X-CSRF-Token'))) {
      throw new AuthError(403, 'CSRF_REJECTED', 'The request could not be verified.');
    }
    sendSession(
      response,
      await changePassword(session, request.body?.currentPassword, request.body?.newPassword)
    );
  } catch (error) {
    try {
      sendAuthError(response, error);
    } catch (unexpectedError) {
      next(unexpectedError);
    }
  }
});

authRouter.post('/logout', async (request, response, next) => {
  try {
    const session = await resolveSession(cookieValue(request));
    if (session) {
      if (!approvedOrigin(request) || !csrfMatches(session, request.header('X-CSRF-Token'))) {
        throw new AuthError(403, 'CSRF_REJECTED', 'The request could not be verified.');
      }
      await logout(session);
    }
    response.clearCookie(sessionCookieName, clearCookieOptions).status(204).send();
  } catch (error) {
    try {
      sendAuthError(response, error);
    } catch (unexpectedError) {
      next(unexpectedError);
    }
  }
});

export async function blockForcedPasswordChange(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
) {
  try {
    const session = await resolveSession(cookieValue(request));
    if (session?.mustChangePassword) {
      response.status(403).json({
        error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'Change your initial password to continue.' }
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
