import { Request, Response, NextFunction } from 'express';

const rateLimits = new Map<string, { count: number; resetAt: number }>();

export const rateLimiter = (windowMs: number, maxRequests: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    const ip = req.ip || (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const state = rateLimits.get(ip);

    if (!state || now > state.resetAt) {
      rateLimits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (state.count >= maxRequests) {
      return res.status(429).json({ error: 'Too many login or registration attempts. Please try again later.' });
    }

    state.count++;
    next();
  };
};
