require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mysql = require('mysql2/promise');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({ origin(origin, cb) { if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true); return cb(new Error('Origin not allowed by CORS')); } }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'foodbridge',
  waitForConnections: true, connectionLimit: 10, queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  timezone: 'Z'
});
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const str = (v, max = 255) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const categories = ['Cooked meals','Bakery','Fruits & vegetables','Packaged food','Other'];
const units = ['meals','kg','boxes','items'];

app.get('/api/health', asyncRoute(async (_req, res) => { await pool.query('SELECT 1'); res.json({ ok: true, service: 'FoodBridge API', database: 'connected' }); }));
app.get('/api/listings', asyncRoute(async (req, res) => {
  const search = `%${str(req.query.search, 100)}%`;
  const category = str(req.query.category, 50); const status = str(req.query.status, 30) || 'available';
  let sql = `SELECT l.*, DATE_FORMAT(l.expiry_at, '%Y-%m-%dT%H:%i:%sZ') AS expiryAt, DATE_FORMAT(l.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt FROM food_listings l WHERE l.expiry_at > UTC_TIMESTAMP() AND (l.title LIKE ? OR l.description LIKE ? OR l.pickup_address LIKE ?)`;
  const args = [search, search, search];
  if (status !== 'all') { sql += ' AND l.status = ?'; args.push(status); }
  if (category && categories.includes(category)) { sql += ' AND l.category = ?'; args.push(category); }
  sql += ' ORDER BY l.expiry_at ASC LIMIT 200';
  const [rows] = await pool.query(sql, args); res.json(rows);
}));
app.post('/api/listings', asyncRoute(async (req, res) => {
  const b = req.body || {}; const title = str(b.title, 140), description = str(b.description, 500), address = str(b.pickup_address, 255), donor = str(b.donor_name, 140), contact = str(b.donor_contact, 80);
  const quantity = Number(b.quantity); const expiry = new Date(b.expiry_at); const category = categories.includes(b.category) ? b.category : 'Other'; const unit = units.includes(b.unit) ? b.unit : 'meals';
  if (!title || !description || !address || !donor || !contact || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000 || Number.isNaN(expiry.getTime()) || expiry <= new Date()) return res.status(400).json({ error: 'Enter valid details. Quantity must be positive and expiry must be in the future.' });
  const [result] = await pool.execute('INSERT INTO food_listings (title,category,description,quantity,unit,expiry_at,pickup_address,donor_name,donor_contact) VALUES (?,?,?,?,?,?,?,?,?)', [title,category,description,quantity,unit,expiry.toISOString().slice(0,19).replace('T',' '),address,donor,contact]);
  const [rows] = await pool.execute('SELECT *, DATE_FORMAT(expiry_at, \'%Y-%m-%dT%H:%i:%sZ\') AS expiryAt FROM food_listings WHERE id=?', [result.insertId]); res.status(201).json(rows[0]);
}));
app.get('/api/listings/:id', asyncRoute(async (req, res) => { const [rows] = await pool.execute('SELECT *, DATE_FORMAT(expiry_at, \'%Y-%m-%dT%H:%i:%sZ\') AS expiryAt FROM food_listings WHERE id=?', [Number(req.params.id)]); if (!rows.length) return res.status(404).json({ error: 'Listing not found' }); res.json(rows[0]); }));
app.post('/api/listings/:id/requests', asyncRoute(async (req, res) => {
  const listingId = Number(req.params.id); const b = req.body || {}; const org = str(b.organization_name,140), contact = str(b.contact,80), notes = str(b.notes,500), quantity = Number(b.quantity);
  if (!Number.isInteger(listingId) || listingId < 1 || !org || !contact || !Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: 'Organization, contact and a valid quantity are required.' });
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const [list] = await conn.execute("SELECT * FROM food_listings WHERE id=? AND status='available' AND expiry_at > UTC_TIMESTAMP() FOR UPDATE", [listingId]);
    if (!list.length) { await conn.rollback(); return res.status(409).json({ error: 'This listing is no longer available.' }); }
    if (quantity > list[0].quantity) { await conn.rollback(); return res.status(400).json({ error: `Only ${list[0].quantity} ${list[0].unit} are listed.` }); }
    const [result] = await conn.execute('INSERT INTO pickup_requests (listing_id,organization_name,contact,quantity,notes) VALUES (?,?,?,?,?)',[listingId,org,contact,quantity,notes]);
    await conn.execute("UPDATE food_listings SET status='reserved' WHERE id=?",[listingId]); await conn.commit(); res.status(201).json({ id: result.insertId, listing_id: listingId, organization_name: org, quantity, status: 'pending', message: 'Pickup request submitted.' });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));
app.get('/api/requests', asyncRoute(async (_req, res) => { const [rows] = await pool.query(`SELECT r.*, l.title AS listing_title, l.pickup_address FROM pickup_requests r JOIN food_listings l ON l.id=r.listing_id ORDER BY r.created_at DESC LIMIT 200`); res.json(rows); }));
app.patch('/api/requests/:id/status', asyncRoute(async (req, res) => {
  const status = str(req.body?.status, 30); const allowed = ['confirmed','collected','completed','cancelled']; if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const conn = await pool.getConnection(); try { await conn.beginTransaction(); const [rows] = await conn.execute('SELECT * FROM pickup_requests WHERE id=? FOR UPDATE',[Number(req.params.id)]); if (!rows.length) { await conn.rollback(); return res.status(404).json({ error: 'Request not found.' }); }
    const r = rows[0]; await conn.execute('UPDATE pickup_requests SET status=? WHERE id=?',[status,r.id]);
    if (status === 'cancelled') await conn.execute("UPDATE food_listings SET status='available' WHERE id=? AND status='reserved'",[r.listing_id]);
    if (status === 'collected' || status === 'completed') await conn.execute("UPDATE food_listings SET status='collected' WHERE id=?",[r.listing_id]);
    await conn.commit(); res.json({ id:r.id, status });
  } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));
app.use((req,res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((err, _req, res, _next) => { console.error(err); if (err.message === 'Origin not allowed by CORS') return res.status(403).json({ error: err.message }); res.status(500).json({ error: 'Server error. Check backend logs and database connection.' }); });
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`FoodBridge API listening on ${port}`));
