import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

export interface AuthRequest extends Request {
  authenticated?: boolean;
}

export function createAuthMiddleware(authToken: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      Logger.warn('Missing authorization header');
      res.status(401).json({
        error: {
          message: 'Missing authorization header',
          type: 'invalid_request_error',
          code: 'missing_authorization',
        },
      });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      Logger.warn('Invalid authorization header format');
      res.status(401).json({
        error: {
          message: 'Invalid authorization header format. Expected: Bearer <token>',
          type: 'invalid_request_error',
          code: 'invalid_authorization_format',
        },
      });
      return;
    }

    const token = parts[1];

    if (token !== authToken) {
      Logger.warn('Invalid authentication token');
      res.status(401).json({
        error: {
          message: 'Invalid authentication token',
          type: 'invalid_request_error',
          code: 'invalid_token',
        },
      });
      return;
    }

    req.authenticated = true;
    next();
  };
}
