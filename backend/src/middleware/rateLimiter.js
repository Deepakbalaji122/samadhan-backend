import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication routes.
 * Max 10 requests per minute per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    message: 'Too many requests. Please try again after 1 minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for OTP routes.
 * In development: 50 requests/min. In production: 5 requests/min.
 */
export const otpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again after 1 minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API rate limiter.
 * Max 100 requests per minute per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
