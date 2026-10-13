import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const requestId = req.id || null;

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: err.issues.map(i => ({
          path: i.path.join('.'),
          issue: i.code,
          message: i.message
        })),
        requestId
      }
    });
  }

  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 404 ? 'NOT_FOUND' : status === 400 ? 'VALIDATION_FAILED' : 'INTERNAL');
  const message = err.message || 'An internal error occurred';

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[Error ${requestId}]`, err);
  }

  res.status(status).json({
    error: {
      code,
      message,
      details: err.details || undefined,
      requestId
    }
  });
}
