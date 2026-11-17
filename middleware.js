// Application middleware and in-memory admin sessions.
const { randomUUID } = require('crypto');

const adminSessions = new Map();
const loginAttempts = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const entry = cookieHeader.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function createAdminSession() {
  const sessionId = randomUUID();
  adminSessions.set(sessionId, Date.now() + SESSION_TTL_MS);
  return sessionId;
}

function getValidAdminSession(req) {
  const sessionId = readCookie(req, 'coffee_admin_session');
  if (!sessionId) return null;

  const expiresAt = adminSessions.get(sessionId);
  if (!expiresAt) return null;

  if (Date.now() > expiresAt) {
    adminSessions.delete(sessionId);
    return null;
  }
  return sessionId;
}

function destroyAdminSession(req) {
  const sessionId = readCookie(req, 'coffee_admin_session');
  if (sessionId) adminSessions.delete(sessionId);
}

function isLoginRateLimited(ip) {
  const now = Date.now();
  const attempts = (loginAttempts.get(ip) || []).filter(time => now - time < LOGIN_WINDOW_MS);
  loginAttempts.set(ip, attempts);
  return attempts.length >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const attempts = (loginAttempts.get(ip) || []).filter(time => now - time < LOGIN_WINDOW_MS);
  attempts.push(now);
  loginAttempts.set(ip, attempts);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function logger(req, res, next) {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
}

// Browser requests authenticate through an HttpOnly cookie.
// Postman can use the x-auth-token header with a session ID obtained from the login response.
function requireAuth(req, res, next) {
  const cookieSession = getValidAdminSession(req);
  const headerSession = req.headers['x-auth-token'];
  const headerValid = typeof headerSession === 'string' &&
    adminSessions.has(headerSession) &&
    Date.now() <= adminSessions.get(headerSession);

  if (!cookieSession && !headerValid) {
    return res.status(401).json({
      success: false,
      error: { message: 'Unauthorized: please sign in as Admin again.' }
    });
  }
  next();
}

function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: { message: err.message || 'Internal server error.' }
  });
}

module.exports = {
  logger, requireAuth, notFound, errorHandler,
  createAdminSession, getValidAdminSession, destroyAdminSession,
  isLoginRateLimited, recordFailedLogin, clearLoginAttempts
};
