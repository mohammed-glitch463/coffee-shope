require('dotenv').config(); // Load credentials from the local .env file.
// Main server file: middleware -> routes -> 404 handler -> error handler.
const express = require('express');
const path = require('path');
const {
  logger, notFound, errorHandler, createAdminSession, getValidAdminSession,
  destroyAdminSession, isLoginRateLimited, recordFailedLogin, clearLoginAttempts
} = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;
const STUDENT_NAME = process.env.STUDENT_NAME || 'Your Name';

app.use(express.json());
app.use(logger);

// GET / returns the API welcome message to API clients and the website to browsers.
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  res.status(200).json({
    message: `Welcome ${STUDENT_NAME}! This is the Coffee Shop Menu REST API.`,
    theme: 'Coffee shop menu',
    website: 'Open http://localhost:3000'
  });
});


// Admin authentication: password is read from the environment.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

app.post('/admin/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (isLoginRateLimited(ip)) {
    return res.status(429).json({
      success: false,
      error: { message: 'Too many login attempts. Please wait 15 minutes and try again.' }
    });
  }

  const { username, password } = req.body || {};
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({
      success: false,
      error: { message: 'Admin password is not configured. Set ADMIN_PASSWORD before starting the server.' }
    });
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    recordFailedLogin(ip);
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid username or password.' }
    });
  }

  clearLoginAttempts(ip);
  const sessionId = createAdminSession();
  res.cookie('coffee_admin_session', sessionId, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 60 * 1000
  });

  // The session ID is also returned for Postman/Thunder Client header-based testing.
  res.status(200).json({ success: true, message: 'Admin login successful.', token: sessionId });
});

app.get('/admin/session', (req, res) => {
  const valid = Boolean(getValidAdminSession(req));
  res.status(200).json({ success: true, authenticated: valid });
});

app.post('/admin/logout', (req, res) => {
  destroyAdminSession(req);
  res.clearCookie('coffee_admin_session', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
  res.status(200).json({ success: true, message: 'Signed out successfully.' });
});

// Dedicated admin URL: the dashboard HTML is outside the public static directory.
app.get('/admin', (req, res) => {
  if (!getValidAdminSession(req)) {
    return res.sendFile(path.join(__dirname, 'private', 'admin.html'), err => {
      if (err) res.status(500).send('Admin page could not be loaded.');
    });
  }
  res.sendFile(path.join(__dirname, 'private', 'admin.html'));
});

app.get('/admin.js', (req, res) => {
  // This script must load before login so it can submit credentials.
  // All protected data/actions remain guarded by authenticated API middleware.
  res.sendFile(path.join(__dirname, 'private', 'admin.js'));
});

// Serve CSS, JavaScript and generated product images.
app.use(express.static(path.join(__dirname, 'public')));

const menuRoutes = require('./routes/menus');
app.use('/menus', menuRoutes);

// Express 5 named wildcard route required by the assignment.
app.get('/files/*path', (req, res) => {
  res.status(200).json({ path: req.params.path });
});

// Keep these handlers last, in this order.
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Coffee Shop Menu server is running at http://localhost:${PORT}`);
});
