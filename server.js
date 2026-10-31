const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT || 3000);
let pool;

function getPool() {
  if (!process.env.DB_HOST) return null;
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'disaster_safety_guide',
      waitForConnections: true,
      connectionLimit: 5,
      enableKeepAlive: true
    });
  }
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ''));
  const right = Buffer.from(String(rightValue || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function requireAdmin(req, res, next) {
  if (req.session?.admin === true) return next();
  return res.status(401).json({ error: 'Administrator sign-in required.' });
}

function requireUser(req, res, next) {
  if (Number.isInteger(req.session?.userId)) return next();
  return res.status(401).json({ error: 'Please sign in to continue.' });
}

async function audit(db, action, entityType, entityId, details, req) {
  await db.execute(
    'INSERT INTO audit_log (admin_email, action_name, entity_type, entity_id, details_json, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
    [req.session.adminEmail, action, entityType, entityId || null, JSON.stringify(details || {}), req.ip]
  );
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-origin' } }));
app.use(express.json({ limit: '96kb' }));
app.use(session({
  name: 'dsg.admin',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  setHeaders(res, file) {
    if (file.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.get('/api/health', async (_req, res) => {
  const db = getPool();
  if (!db) return res.json({ ok: true, database: 'not configured', mode: 'offline-first' });
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, database: 'connected', mode: 'offline-first' });
  } catch {
    res.status(503).json({ ok: false, database: 'unavailable', mode: 'offline-first' });
  }
});

app.get('/api/contacts', async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Database not configured; use the bundled offline contacts.' });
  try {
    const [rows] = await db.execute(
      'SELECT service_name AS name, number, description, color_key AS color FROM emergency_contacts WHERE region_code = ? AND active = TRUE ORDER BY display_order',
      [String(req.query.region || 'IN').slice(0, 8)]
    );
    res.json(rows);
  } catch {
    res.status(503).json({ error: 'Database unavailable; use the bundled offline contacts.' });
  }
});

app.get('/api/content-version', async (_req, res) => {
  const db = getPool();
  try {
    if (!db) throw new Error('Database unavailable');
    const [rows] = await db.query('SELECT version_code AS version, published_at AS publishedAt, notes FROM content_versions WHERE active = TRUE ORDER BY published_at DESC LIMIT 1');
    res.json(rows[0] || { version: '1.0.0', publishedAt: null, bundled: true });
  } catch {
    res.json({ version: '1.0.0', publishedAt: null, bundled: true });
  }
});

app.post('/api/feedback', async (req, res) => {
  const db = getPool();
  const type = cleanText(req.body.type, 40);
  const message = cleanText(req.body.message, 2000);
  const pageUrl = cleanText(req.body.pageUrl, 300);
  const validTypes = ['incorrect-information', 'outdated-contact', 'translation', 'accessibility', 'other'];
  if (!validTypes.includes(type) || message.length < 10) {
    return res.status(400).json({ error: 'Choose a feedback type and enter at least 10 characters.' });
  }
  if (!db) return res.status(503).json({ error: 'Feedback needs the MySQL database. Your text is still in the form.' });
  try {
    const [result] = await db.execute(
      'INSERT INTO feedback_reports (report_type, message_text, page_url, status) VALUES (?, ?, ?, \'new\')',
      [type, message, pageUrl]
    );
    res.status(201).json({ ok: true, reference: `DSG-${result.insertId}` });
  } catch {
    res.status(503).json({ error: 'Feedback could not be saved. Please try again.' });
  }
});

app.get('/api/auth/session', async (req, res) => {
  if (!Number.isInteger(req.session?.userId)) return res.json({ authenticated: false, user: null });
  try {
    const db = getPool();
    const [rows] = await db.execute('SELECT id, full_name AS fullName, email, phone, preferred_language AS preferredLanguage FROM users WHERE id=? AND account_status=\'active\' LIMIT 1', [req.session.userId]);
    if (!rows[0]) {
      delete req.session.userId;
      return res.json({ authenticated: false, user: null });
    }
    res.json({ authenticated: true, user: rows[0] });
  } catch {
    res.status(503).json({ error: 'User account service is temporarily unavailable.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const fullName = cleanText(req.body.fullName, 120);
  const email = cleanText(req.body.email, 190).toLowerCase();
  const phone = cleanText(req.body.phone, 24);
  const password = String(req.body.password || '');
  const language = ['en', 'te', 'hi'].includes(req.body.preferredLanguage) ? req.body.preferredLanguage : 'en';
  if (fullName.length < 2) return res.status(400).json({ error: 'Enter your full name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (phone && !/^[0-9+ ()-]{7,24}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number or leave it blank.' });
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return res.status(400).json({ error: 'Use at least 8 characters with a letter and a number.' });
  try {
    const db = getPool();
    if (!db) throw new Error('Database unavailable');
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.execute('INSERT INTO users (full_name, email, phone, password_hash, preferred_language) VALUES (?, ?, ?, ?, ?)', [fullName, email, phone || null, passwordHash, language]);
    req.session.userId = Number(result.insertId);
    res.status(201).json({ authenticated: true, user: { id: Number(result.insertId), fullName, email, phone: phone || null, preferredLanguage: language } });
  } catch (error) {
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 503).json({ error: error.code === 'ER_DUP_ENTRY' ? 'An account with this email already exists.' : 'Account creation is unavailable. Confirm the database migration was applied.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = cleanText(req.body.email, 190).toLowerCase();
  const password = String(req.body.password || '');
  try {
    const db = getPool();
    if (!db) throw new Error('Database unavailable');
    const [rows] = await db.execute('SELECT id, full_name, email, phone, password_hash, preferred_language, account_status FROM users WHERE email=? LIMIT 1', [email]);
    const user = rows[0];
    if (!user || user.account_status !== 'active' || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Incorrect email or password.' });
    req.session.userId = Number(user.id);
    await db.execute('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?', [user.id]);
    res.json({ authenticated: true, user: { id: Number(user.id), fullName: user.full_name, email: user.email, phone: user.phone, preferredLanguage: user.preferred_language } });
  } catch (error) {
    if (error.message === 'Incorrect email or password.') return res.status(401).json({ error: error.message });
    res.status(503).json({ error: 'Sign in is temporarily unavailable.' });
  }
});

app.post('/api/auth/logout', requireUser, (req, res) => {
  delete req.session.userId;
  res.json({ ok: true });
});

app.put('/api/profile', requireUser, async (req, res) => {
  const fullName = cleanText(req.body.fullName, 120);
  const phone = cleanText(req.body.phone, 24);
  const language = ['en', 'te', 'hi'].includes(req.body.preferredLanguage) ? req.body.preferredLanguage : 'en';
  if (fullName.length < 2) return res.status(400).json({ error: 'Enter your full name.' });
  if (phone && !/^[0-9+ ()-]{7,24}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number or leave it blank.' });
  try {
    const db = getPool();
    await db.execute('UPDATE users SET full_name=?, phone=?, preferred_language=? WHERE id=?', [fullName, phone || null, language, req.session.userId]);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'Profile could not be updated.' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const email = cleanText(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  const expectedEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase();
  const expectedPassword = String(process.env.ADMIN_PASSWORD || '');
  if (!expectedEmail || !expectedPassword) return res.status(503).json({ error: 'Administrator access is not configured. Add ADMIN_EMAIL and ADMIN_PASSWORD to a local .env file.' });
  if (!safeEqual(email, expectedEmail) || !safeEqual(password, expectedPassword)) return res.status(401).json({ error: 'Incorrect email or password.' });
  req.session.admin = true;
  req.session.adminEmail = expectedEmail;
  return res.json({ ok: true, email: expectedEmail });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: req.session?.admin === true, email: req.session?.adminEmail || null });
});

app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Connect MySQL and run database/schema.sql to activate content management.' });
  try {
    const [rows] = await db.query(`SELECT
      (SELECT COUNT(*) FROM disaster_guides) AS disasters,
      (SELECT COUNT(*) FROM first_aid_guides) AS firstAid,
      (SELECT COUNT(*) FROM emergency_contacts WHERE active=TRUE) AS contacts,
      (SELECT COUNT(*) FROM feedback_reports WHERE status='new') AS newFeedback,
      (SELECT COUNT(*) FROM content_reviews) AS reviews`);
    res.json(rows[0]);
  } catch {
    res.status(503).json({ error: 'Database schema is not ready. Run database/schema.sql in MySQL Workbench.' });
  }
});

app.get('/api/admin/contacts', requireAdmin, async (_req, res) => {
  try {
    const db = getPool();
    if (!db) throw new Error('Database unavailable');
    const [rows] = await db.query('SELECT * FROM emergency_contacts ORDER BY display_order, id');
    res.json(rows);
  } catch {
    res.status(503).json({ error: 'Contact records are unavailable.' });
  }
});

app.post('/api/admin/contacts', requireAdmin, async (req, res) => {
  const record = {
    region: cleanText(req.body.regionCode || 'IN', 8),
    name: cleanText(req.body.serviceName, 100),
    number: cleanText(req.body.number, 24),
    description: cleanText(req.body.description, 180),
    color: cleanText(req.body.colorKey || 'blue', 16),
    source: cleanText(req.body.sourceUrl, 500),
    order: Number(req.body.displayOrder || 0)
  };
  if (!record.name || !/^[0-9+ -]{3,24}$/.test(record.number)) return res.status(400).json({ error: 'A service name and valid phone number are required.' });
  try {
    const db = getPool();
    if (!db) throw new Error('Database unavailable');
    const [result] = await db.execute(
      'INSERT INTO emergency_contacts (region_code, service_name, number, description, color_key, source_url, verified_at, display_order, active) VALUES (?, ?, ?, ?, ?, ?, CURRENT_DATE, ?, TRUE)',
      [record.region, record.name, record.number, record.description, record.color, record.source || null, record.order]
    );
    await audit(db, 'create', 'emergency_contact', result.insertId, record, req);
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (error) {
    res.status(400).json({ error: error.code === 'ER_DUP_ENTRY' ? 'That regional number already exists.' : 'Contact could not be created.' });
  }
});

app.put('/api/admin/contacts/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const name = cleanText(req.body.serviceName, 100);
  const description = cleanText(req.body.description, 180);
  const active = req.body.active === true || req.body.active === 1;
  if (!Number.isInteger(id) || !name) return res.status(400).json({ error: 'Invalid contact record.' });
  try {
    const db = getPool();
    await db.execute('UPDATE emergency_contacts SET service_name=?, description=?, active=?, verified_at=CURRENT_DATE WHERE id=?', [name, description, active, id]);
    await audit(db, 'update', 'emergency_contact', id, { name, active }, req);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'Contact could not be updated.' });
  }
});

app.delete('/api/admin/contacts/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid contact record.' });
  try {
    const db = getPool();
    await db.execute('UPDATE emergency_contacts SET active=FALSE WHERE id=?', [id]);
    await audit(db, 'archive', 'emergency_contact', id, {}, req);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'Contact could not be archived.' });
  }
});

app.get('/api/admin/feedback', requireAdmin, async (_req, res) => {
  try {
    const db = getPool();
    if (!db) throw new Error('Database unavailable');
    const [rows] = await db.query('SELECT id, report_type, message_text, page_url, status, created_at FROM feedback_reports ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  } catch {
    res.status(503).json({ error: 'Feedback records are unavailable.' });
  }
});

app.put('/api/admin/feedback/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = cleanText(req.body.status, 20);
  if (!['new', 'reviewing', 'resolved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  try {
    const db = getPool();
    await db.execute('UPDATE feedback_reports SET status=?, resolved_at=IF(? IN (\'resolved\',\'rejected\'),CURRENT_TIMESTAMP,NULL) WHERE id=?', [status, status, id]);
    await audit(db, 'status-change', 'feedback', id, { status }, req);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ error: 'Feedback status could not be updated.' });
  }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.locals.closeDatabase = closePool;
if (require.main === module) app.listen(port, () => console.log(`Disaster Safety Guide running at http://localhost:${port}`));
module.exports = app;
