import { verifyAdminSession } from '../services/tokenService.js';

export function adminAuth(req, res, next) {
  const token = req.cookies?.bf_admin;
  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Admin session cookie missing',
        requestId: req.id || null
      }
    });
  }

  const decoded = verifyAdminSession(token);
  if (!decoded || !decoded.username) {
    return res.status(401).json({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Admin session expired or invalid',
        requestId: req.id || null
      }
    });
  }

  // Double-submit CSRF verification for mutating requests
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (mutatingMethods.includes(req.method.toUpperCase())) {
    const csrfHeader = req.headers['x-csrf-token'];
    const csrfCookie = req.cookies?.bf_csrf;

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({
        error: {
          code: 'CSRF_MISMATCH',
          message: 'Invalid or missing CSRF token',
          requestId: req.id || null
        }
      });
    }
  }

  req.admin = {
    username: decoded.username
  };

  next();
}
