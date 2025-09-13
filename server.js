import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import multer from 'multer';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
// Ensure directories for uploads and pdfs
const uploadsDir = path.join(__dirname, 'uploads');
const pdfsDir = path.join(__dirname, 'pdfs');
const pdfsSignedDir = path.join(__dirname, 'pdfsigne');
const planjpgDir = path.join(__dirname, 'planjpg');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir);
if (!fs.existsSync(pdfsSignedDir)) fs.mkdirSync(pdfsSignedDir);
if (!fs.existsSync(planjpgDir)) fs.mkdirSync(planjpgDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  if (!/\.(jpg|jpeg|png)$/i.test(file.originalname)) return cb(new Error('Only images (jpg,jpeg,png)'));
  cb(null, true);
}});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD !== undefined ? String(process.env.PGPASSWORD) : undefined,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function runMigrationsAndSeed() {
  const client = await pool.connect();
  try {
    const schemaSql = await Bun.file ? await Bun.file(path.join(__dirname, 'db', 'schema.sql')).text() : null;
  } catch (e) {}
  try {
    // Fallback to fs if Bun is not available
    const fs = await import('fs/promises');
    const schema = await fs.readFile(path.join(__dirname, 'db', 'schema.sql'), 'utf-8');
    await client.query(schema);

    const seed = await fs.readFile(path.join(__dirname, 'db', 'seed.sql'), 'utf-8');
    await client.query(seed);

    // Ensure seeded admins have a password
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(defaultPassword, 10);
    await client.query(
      `UPDATE admin SET mdp_hash = $1 WHERE (email = 'khalid@gmail.com' OR email = 'lahlou@gmail.com') AND (mdp_hash IS NULL OR mdp_hash = '')`,
      [hash]
    );

    // Defensive migrations for demande columns (in case table pre-existed without these columns)
    await client.query(`ALTER TABLE IF EXISTS demande ADD COLUMN IF NOT EXISTS pdf_path TEXT`);
    await client.query(`ALTER TABLE IF EXISTS demande ADD COLUMN IF NOT EXISTS pdf_signe_path TEXT`);
    await client.query(`ALTER TABLE IF EXISTS demande ADD COLUMN IF NOT EXISTS telephone VARCHAR(30)`);
    await client.query(`CREATE TABLE IF NOT EXISTS notification (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), employee_id INTEGER REFERENCES employee(id) ON DELETE CASCADE, title VARCHAR(200) NOT NULL, body_html TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), read_at TIMESTAMP WITH TIME ZONE)`);
    await client.query(`ALTER TABLE IF EXISTS notification ADD COLUMN IF NOT EXISTS taken_at TIMESTAMP WITH TIME ZONE`);
    await client.query(`ALTER TABLE IF EXISTS notification ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES admin(id)`);
    await client.query(`CREATE TABLE IF NOT EXISTS notification_reply (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), notification_id UUID REFERENCES notification(id) ON DELETE CASCADE, sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('employee','admin')), sender_employee_id INTEGER, sender_admin_id UUID, body TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`);
  } finally {
    client.release();
  }
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Admin identity
app.get('/api/admin/me', requireAuth, async (req, res) => {
  try {
    const id = req.user.adminId;
    const { rows } = await pool.query('SELECT id, nom, prenom, email, created_at FROM admin WHERE id = $1', [id]);
    const admin = rows[0];
    if (!admin) return res.status(404).json({ error: 'Not found' });
    res.json(admin);
  } catch (e) {
    res.status(500).json({ error: 'Server error', details: String(e?.message || e) });
  }
});

// Admin inbox: list notifications (optionally by secteur) and replies; reply as admin
app.get('/api/admin/notifications', requireAuth, async (req, res) => {
  const { secteur } = req.query;
  let q = `SELECT n.id, n.employee_id, e.nom, e.prenom, e.secteur, n.title, n.body_html, n.created_at, n.read_at, n.taken_at
           FROM notification n JOIN employee e ON e.id = n.employee_id`;
  const params = [];
  if (secteur) { q += ' WHERE e.secteur = $1'; params.push(secteur); }
  q += ' ORDER BY n.created_at DESC LIMIT 200';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});
app.get('/api/admin/notifications/:id/replies', requireAuth, async (req, res) => {
  const id = req.params.id;
  const { rows } = await pool.query('SELECT id, sender_type, body, created_at FROM notification_reply WHERE notification_id = $1 ORDER BY created_at ASC', [id]);
  res.json(rows);
});
app.post('/api/admin/notifications/:id/replies', requireAuth, async (req, res) => {
  const id = req.params.id;
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body required' });
  await pool.query('INSERT INTO notification_reply (notification_id, sender_type, sender_admin_id, body) VALUES ($1,$2,$3,$4)', [id, 'admin', req.user.adminId, body]);
  res.status(201).json({ ok: true });
});

function requireEmployeeAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  console.log('Employee auth - token:', token ? 'present' : 'missing');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
    console.log('JWT Secret:', jwtSecret ? 'set' : 'missing');
    const payload = jwt.verify(token, jwtSecret);
    console.log('Token payload:', payload);
    if (!payload.employeeId) return res.status(403).json({ error: 'Forbidden' });
    req.employee = payload;
    next();
  } catch (e) {
    console.error('JWT verification error:', e.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const { rows } = await pool.query('SELECT * FROM admin WHERE email = $1', [email]);
  const admin = rows[0];
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, admin.mdp_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ adminId: admin.id, email: admin.email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '8h' });
  res.json({ token, admin: { id: admin.id, nom: admin.nom, prenom: admin.prenom, email: admin.email } });
});

// Unified login for admin or employee
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  // Try admin first
  const a = await pool.query('SELECT * FROM admin WHERE email = $1', [email]);
  const admin = a.rows[0];
  if (admin && await bcrypt.compare(password, admin.mdp_hash)) {
    const token = jwt.sign({ role: 'admin', adminId: admin.id, email: admin.email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '8h' });
    return res.json({ token, role: 'admin', user: { id: admin.id, nom: admin.nom, prenom: admin.prenom, email: admin.email } });
  }
  // Try employee
  const e = await pool.query('SELECT * FROM employee WHERE email = $1', [email]);
  const emp = e.rows[0];
  if (emp && emp.mdp_hash && await bcrypt.compare(password, emp.mdp_hash)) {
    const token = jwt.sign({ role: 'employee', employeeId: emp.id, email: emp.email, secteur: emp.secteur }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '8h' });
    return res.json({ token, role: 'employee', user: { id: emp.id, nom: emp.nom, prenom: emp.prenom, email: emp.email, secteur: emp.secteur } });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/employees', requireAuth, async (req, res) => {
  const { nom, prenom, secteur, email, password } = req.body;
  if (!nom || !prenom || !secteur) return res.status(400).json({ error: 'nom, prenom, secteur required' });
  if (email && typeof email !== 'string') return res.status(400).json({ error: 'invalid email' });
  if (password && typeof password !== 'string') return res.status(400).json({ error: 'invalid password' });
  if (!['finance', 'chantier', 'production'].includes(secteur)) return res.status(400).json({ error: 'invalid secteur' });
  const adminId = req.user.adminId;
  let hash = null;
  if (password) {
    hash = await bcrypt.hash(password, 10);
  }
  const { rows } = await pool.query(
    'INSERT INTO employee (nom, prenom, secteur, email, mdp_hash, adminref) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [nom, prenom, secteur, email || null, hash, adminId]
  );
  res.status(201).json(rows[0]);
});

app.get('/api/employees', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM employee ORDER BY id DESC');
  res.json(rows);
});

// Employee login
app.post('/api/employee/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const { rows } = await pool.query('SELECT * FROM employee WHERE email = $1', [email]);
  const emp = rows[0];
  if (!emp || !emp.mdp_hash) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, emp.mdp_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign(
    { employeeId: emp.id, email: emp.email, secteur: emp.secteur },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '8h' }
  );
  res.json({ token, employee: { id: emp.id, nom: emp.nom, prenom: emp.prenom, email: emp.email, secteur: emp.secteur } });
});

app.get('/api/employee/me', requireEmployeeAuth, async (req, res) => {
  const id = req.employee.employeeId;
  console.log('Getting employee data for ID:', id);
  try {
    const { rows } = await pool.query('SELECT id, nom, prenom, email, secteur, adminref, created_at FROM employee WHERE id = $1', [id]);
    const emp = rows[0];
    console.log('Employee found:', emp ? 'yes' : 'no');
    console.log('Query result:', rows);
    
    if (!emp) {
      // Si l'employé n'existe pas, essayer de le créer avec les données du token
      console.log('Employee not found, creating from token data...');
      const { email, secteur } = req.employee;
      const { rows: newRows } = await pool.query(
        'INSERT INTO employee (id, nom, prenom, secteur, email, mdp_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nom, prenom, email, secteur, adminref, created_at',
        [id, 'Utilisateur', 'Test', secteur, email, '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K']
      );
      const newEmp = newRows[0];
      console.log('Created new employee:', newEmp);
      return res.json(newEmp);
    }
    
    res.json(emp);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Notifications endpoints
app.get('/api/employee/notifications', requireEmployeeAuth, async (req, res) => {
  const id = req.employee.employeeId;
  const { rows } = await pool.query(
    `SELECT n.id, n.title, n.body_html, n.created_at, n.read_at, n.taken_at, n.created_by_admin,
            a.nom AS admin_nom, a.prenom AS admin_prenom
     FROM notification n
     LEFT JOIN admin a ON a.id = n.created_by_admin
     WHERE n.employee_id = $1
     ORDER BY n.created_at DESC`,
    [id]
  );
  res.json(rows);
});
app.post('/api/employee/notifications/:id/read', requireEmployeeAuth, async (req, res) => {
  const id = req.params.id;
  const emp = req.employee.employeeId;
  await pool.query('UPDATE notification SET read_at = NOW() WHERE id = $1 AND employee_id = $2', [id, emp]);
  res.json({ ok: true });
});
app.post('/api/employee/notifications/:id/take', requireEmployeeAuth, async (req, res) => {
  const id = req.params.id;
  const emp = req.employee.employeeId;
  await pool.query('UPDATE notification SET taken_at = NOW() WHERE id = $1 AND employee_id = $2', [id, emp]);
  res.json({ ok: true });
});
app.get('/api/employee/notifications/:id/replies', requireEmployeeAuth, async (req, res) => {
  const id = req.params.id;
  // Ensure ownership
  const { rows: own } = await pool.query('SELECT 1 FROM notification WHERE id = $1 AND employee_id = $2', [id, req.employee.employeeId]);
  if (!own.length) return res.status(404).json({ error: 'Not found' });
  const { rows } = await pool.query('SELECT id, sender_type, body, created_at FROM notification_reply WHERE notification_id = $1 ORDER BY created_at ASC', [id]);
  res.json(rows);
});
app.post('/api/employee/notifications/:id/replies', requireEmployeeAuth, async (req, res) => {
  const id = req.params.id;
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body required' });
  // Ensure ownership
  const { rows: own } = await pool.query('SELECT created_by_admin FROM notification WHERE id = $1 AND employee_id = $2', [id, req.employee.employeeId]);
  const notif = own[0];
  if (!notif) return res.status(404).json({ error: 'Not found' });
  await pool.query('INSERT INTO notification_reply (notification_id, sender_type, sender_employee_id, body) VALUES ($1,$2,$3,$4)', [id, 'employee', req.employee.employeeId, body]);
  // Optional: notify admin in future (e.g., email or another channel)
  res.status(201).json({ ok: true });
});

// Admin notify employees by sector with an HTML message
app.post('/api/admin/notify', requireAuth, async (req, res) => {
  const { secteur, title, body_html } = req.body || {};
  if (!secteur || !title || !body_html) return res.status(400).json({ error: 'secteur, title and body_html required' });
  const { rows: emps } = await pool.query('SELECT id FROM employee WHERE secteur = $1', [secteur]);
  for (const e of emps) {
    await pool.query('INSERT INTO notification (employee_id, title, body_html, created_by_admin) VALUES ($1,$2,$3,$4)', [e.id, title, body_html, req.user.adminId]);
  }
  res.json({ ok: true, count: emps.length });
});

// Demande endpoints
app.get('/api/demandes', requireEmployeeAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM demande ORDER BY created_at DESC');
  res.json(rows);
});

app.get('/api/admin/demandes', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM demande ORDER BY created_at DESC');
  res.json(rows);
});

// Messaging APIs
app.get('/api/admin/list', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, nom, prenom, email FROM admin ORDER BY nom');
  res.json(rows);
});

app.get('/api/messages/:contactId', requireEmployeeAuth, async (req, res) => {
  const contactId = req.params.contactId;
  const employeeId = req.employee.employeeId;
  
  // Parse contact ID to get actual user ID and type
  const [type, id] = contactId.split('_');
  
  let query, params;
  if (type === 'admin') {
    // Messages between employee and admin
    query = `
      SELECT m.*, 
             CASE 
               WHEN m.sender_type = 'employee' THEN e.nom || ' ' || e.prenom
               ELSE a.nom || ' ' || a.prenom
             END as sender_name
      FROM message m
      LEFT JOIN employee e ON m.sender_type = 'employee' AND m.sender_id = e.id
      LEFT JOIN admin a ON m.sender_type = 'admin' AND m.sender_id = a.id
      WHERE (m.sender_id = $1 AND m.recipient_id = $2 AND m.sender_type = 'employee' AND m.recipient_type = 'admin')
         OR (m.sender_id = $2 AND m.recipient_id = $1 AND m.sender_type = 'admin' AND m.recipient_type = 'employee')
      ORDER BY m.created_at ASC
    `;
    params = [employeeId, id];
  } else {
    // Messages between employees
    query = `
      SELECT m.*, 
             CASE 
               WHEN m.sender_type = 'employee' THEN e.nom || ' ' || e.prenom
               ELSE a.nom || ' ' || a.prenom
             END as sender_name
      FROM message m
      LEFT JOIN employee e ON m.sender_type = 'employee' AND m.sender_id = e.id
      LEFT JOIN admin a ON m.sender_type = 'admin' AND m.sender_id = a.id
      WHERE (m.sender_id = $1 AND m.recipient_id = $2 AND m.sender_type = 'employee' AND m.recipient_type = 'employee')
         OR (m.sender_id = $2 AND m.recipient_id = $1 AND m.sender_type = 'employee' AND m.recipient_type = 'employee')
      ORDER BY m.created_at ASC
    `;
    params = [employeeId, id];
  }
  
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

app.post('/api/messages', requireEmployeeAuth, async (req, res) => {
  const { recipient_id, content } = req.body;
  const employeeId = req.employee.employeeId;
  
  if (!recipient_id || !content) {
    return res.status(400).json({ error: 'recipient_id and content required' });
  }
  
  // Parse recipient ID
  const [type, id] = recipient_id.split('_');
  
  let recipientType, recipientId;
  if (type === 'admin') {
    recipientType = 'admin';
    recipientId = id;
  } else {
    recipientType = 'employee';
    recipientId = id;
  }
  
  const { rows } = await pool.query(
    `INSERT INTO message (sender_id, sender_type, recipient_id, recipient_type, content)
     VALUES ($1, 'employee', $2, $3, $4)
     RETURNING *`,
    [employeeId, recipientId, recipientType, content]
  );
  
  res.status(201).json(rows[0]);
});

// Employee creates demande
app.post('/api/demandes', requireEmployeeAuth, upload.single('plan_jpg'), async (req, res) => {
  const { nom, prenom, type_projet, prix, statut, telephone } = req.body;
  if (!nom || !prenom || !type_projet || prix === undefined) return res.status(400).json({ error: 'missing fields' });
  const st = statut && ['livré','encours'].includes(statut) ? statut : 'encours';
  const fileName = req.file ? req.file.filename : null;
  const { rows } = await pool.query(
    `INSERT INTO demande (nom, prenom, telephone, type_projet, plan_jpg, prix, statut)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [nom, prenom, telephone || null, type_projet, fileName, prix, st]
  );
  res.status(201).json(rows[0]);
});

app.post('/api/demandes/:id/pdf', async (req, res) => {
  const id = req.params.id;
  const { rows } = await pool.query('SELECT * FROM demande WHERE iddemande = $1', [id]);
  const d = rows[0];
  if (!d) return res.status(404).json({ error: 'Not found' });
  const pdfPath = path.join(pdfsDir, `${id}.pdf`);

  const doc = new PDFDocument({ autoFirstPage: true, margins: { top: 50, bottom: 50, left: 50, right: 50 } });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  // Header with logo and company info
  try {
    const logoPath = path.join(__dirname, 'asset', 'téléchargement.jpg');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 48, height: 48 });
    }
  } catch {}
  doc.fontSize(18).fillColor('#0d47a1').text('Zalagh Plancher', 110, 45);
  doc.fontSize(10).fillColor('#1f2937').text('Devis / Demande', 110, 68);
  doc.moveTo(50, 95).lineTo(545, 95).strokeColor('#e5e7eb').stroke();

  // Client/info block
  doc.moveDown(2);
  doc.fontSize(12).fillColor('#1f2937');
  doc.text(`N° Demande: ${d.iddemande}`);
  doc.text(`Client: ${d.nom} ${d.prenom}`);
  if (d.telephone) doc.text(`Téléphone: ${d.telephone}`);
  doc.text(`Type de projet: ${d.type_projet}`);
  doc.text(`Statut: ${d.statut}`);
  doc.moveDown();

  // Table-like summary
  const startX = 50;
  let y = doc.y + 10;
  const colW = [300, 100, 100];
  const headers = ['Désignation', 'Qté/Unité', 'Montant (DH)'];
  doc.rect(startX, y, 495, 20).fill('#f3f4f6').stroke('#e5e7eb');
  doc.fillColor('#0d47a1').fontSize(11).text(headers[0], startX + 8, y + 5);
  doc.text(headers[1], startX + colW[0] + 8, y + 5);
  doc.text(headers[2], startX + colW[0] + colW[1] + 8, y + 5);
  y += 24;

  doc.fillColor('#1f2937').fontSize(11);
  doc.text('Estimation fourniture béton prêt à l’emploi', startX + 8, y);
  doc.text('-', startX + colW[0] + 8, y);
  doc.text(String(d.prix ?? ''), startX + colW[0] + colW[1] + 8, y);
  y += 18;

  doc.moveTo(startX, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
  y += 10;
  doc.fontSize(12).fillColor('#0b7a42').text(`Total TTC (indicatif): ${d.prix} DH`, startX + colW[0] + colW[1] + 8, y);
  y += 24;
  doc.fillColor('#6b7280').fontSize(9).text('Prix unitaire de référence: 150 DH / m³. Valable sous réserve de confirmation et conditions de chantier.', startX, y, { width: 495 });

  // Plan page if exists
  if (d.plan_jpg) {
    try {
      let planPath = d.plan_jpg;
      if (!path.isAbsolute(planPath)) {
        if (planPath.startsWith('/planjpg/')) {
          planPath = path.join(__dirname, planPath.replace(/^\/+/, ''));
        } else {
          planPath = path.join(uploadsDir, planPath.replace(/^\/+/, ''));
        }
      }
      if (fs.existsSync(planPath)) {
        doc.addPage();
        doc.fontSize(16).fillColor('#0d47a1').text('Plan du projet', { align: 'left' });
        doc.moveDown();
        doc.image(planPath, { fit: [500, 700], align: 'center', valign: 'center' });
        // Footer for plan page
        doc.moveTo(50, 760).lineTo(545, 760).strokeColor('#e5e7eb').stroke();
        doc.fontSize(9).fillColor('#6b7280').text('Zalagh Plancher — Devis généré automatiquement', 50, 765, { align: 'center', width: 495 });
      }
    } catch {}
  }

  // Footer for first page
  doc.moveTo(50, 760).lineTo(545, 760).strokeColor('#e5e7eb').stroke();
  doc.fontSize(9).fillColor('#6b7280').text('Zalagh Plancher — Devis généré automatiquement', 50, 765, { align: 'center', width: 495 });

  doc.end();
  stream.on('finish', async () => {
    await pool.query('UPDATE demande SET pdf_path = $1 WHERE iddemande = $2', [`/pdfs/${id}.pdf`, id]);
    res.json({ pdf: `/pdfs/${id}.pdf` });
  });
});

app.post('/api/admin/demandes/:id/upload-pdf', requireAuth, async (req, res) => {
  const id = req.params.id;
  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ error: 'missing base64' });
  const pdfPath = path.join(pdfsSignedDir, `${id}-uploaded.pdf`);
  const data = Buffer.from(base64, 'base64');
  fs.writeFileSync(pdfPath, data);
  await pool.query('UPDATE demande SET pdf_signe_path = $1, statut = $2 WHERE iddemande = $3', [`/pdfsigne/${path.basename(pdfPath)}`, 'livré', id]);
  res.json({ pdf_signe: `/pdfsigne/${path.basename(pdfPath)}`, statut: 'livré' });
});

// Employee can upload signed PDF too
app.post('/api/demandes/:id/upload-pdf', requireEmployeeAuth, async (req, res) => {
  const id = req.params.id;
  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ error: 'missing base64' });
  const pdfPath = path.join(pdfsSignedDir, `${id}-signed-by-emp.pdf`);
  const data = Buffer.from(base64, 'base64');
  fs.writeFileSync(pdfPath, data);
  await pool.query('UPDATE demande SET pdf_signe_path = $1, statut = $2 WHERE iddemande = $3', [`/pdfsigne/${path.basename(pdfPath)}`, 'livré', id]);
  res.json({ pdf_signe: `/pdfsigne/${path.basename(pdfPath)}`, statut: 'livré' });
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));
app.use('/pdfs', express.static(pdfsDir));
app.use('/pdfsigne', express.static(pdfsSignedDir));
app.use('/asset', express.static(path.join(__dirname, 'asset')));
app.use('/planjpg', express.static(planjpgDir));

// AI: Vision analysis via Gemini REST API (no SDK required)
app.post('/api/ai/vision', upload.array('images', 8), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    }
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ error: 'at least one image required' });
    const prompt = req.body.prompt || 'Analyse ces plans béton (images) en français et extrais dimensions, épaisseur, surfaces, volume total en m3 et hypothèses.';

    // Build parts for all images and persist copies
    const parts = [{ text: `${prompt}\nRègles de formatage: réponds en français, commence par un court titre en <strong>, puis liste à puces; insère des sauts de ligne <br/> entre sections; mets les nombres clés en <strong>. Si possible, fournis UNE ligne JSON: {"volume_m3": nombre}.` }];
    const publicPlanPaths = [];
    for (const f of files) {
      const imgPath = path.join(uploadsDir, f.filename);
      const mime = f.mimetype || 'image/jpeg';
      const base64 = fs.readFileSync(imgPath, { encoding: 'base64' });

      const safeName = f.originalname ? f.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_') : `${Date.now()}.jpg`;
      const finalName = `${Date.now()}_${safeName}`;
      const finalDiskPath = path.join(planjpgDir, finalName);
      try { fs.copyFileSync(imgPath, finalDiskPath); } catch {}
      const publicPlanPath = `/planjpg/${finalName}`;
      publicPlanPaths.push(publicPlanPath);

      parts.push({ inlineData: { mimeType: mime, data: base64 } });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const body = { contents: [ { role: 'user', parts } ] };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('Gemini API error', r.status, errText);
      return res.status(500).json({ error: 'Gemini request failed', status: r.status, details: errText });
    }
    const data = await r.json();
    let text = '';
    try {
      text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
    } catch {}

    // Optional cost extraction if JSON line exists
    let volume_m3 = null;
    try {
      const match = text.match(/\{\s*\"volume_m3\"\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*}/);
      if (match) volume_m3 = Number(match[1]);
    } catch {}
    const pricePerM3 = 150;
    const cost = volume_m3 != null && !Number.isNaN(volume_m3) ? volume_m3 * pricePerM3 : null;

    // Clean up temp uploads
    try { for (const f of files) { fs.unlinkSync(path.join(uploadsDir, f.filename)); } } catch {}

    return res.json({ text, volume_m3, price_per_m3: pricePerM3, estimated_cost_dh: cost, plan_jpgs: publicPlanPaths, plan_jpg: publicPlanPaths[0] });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e?.message || e) });
  }
});

// AI: Text chat with optional vision context
app.post('/api/ai/chat', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    }
    const { messages, visionContext } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const systemPreamble = `Tu es un assistant expert pour Zalagh Plancher (entreprise de béton). Prix fixe: 150 DH par m³. Réponds en français et applique ces règles de formatage: \n- Titre court en <strong>\n- Réponse en listes à puces si possible\n- Sauts de ligne avec <br/> entre sections\n- Mots/nombres clés en <strong>\n- Si calcul de volume: ajoute UNE ligne JSON: {"volume_m3": nombre}\nNe change jamais le prix par m³.`;
    let contextText = '';
    if (visionContext) {
      const { text, volume_m3, price_per_m3, estimated_cost_dh } = visionContext;
      contextText = `Vision analysis summary: ${text || ''}\nVolume(m3): ${volume_m3 ?? 'unknown'}; Price/m3: ${price_per_m3 ?? 150}; Estimated cost(DH): ${estimated_cost_dh ?? 'unknown'}`;
    }
    const contents = [];
    contents.push({ role: 'user', parts: [{ text: systemPreamble + (contextText ? `\n${contextText}` : '') }] });
    for (const m of messages) {
      const role = m.role === 'assistant' ? 'model' : 'user';
      contents.push({ role, parts: [{ text: String(m.content || '') }] });
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const body = { contents };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('Gemini chat error', r.status, errText);
      return res.status(500).json({ error: 'Gemini chat failed', status: r.status, details: errText });
    }
    const data = await r.json();
    let text = '';
    try { text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || ''; } catch {}
    return res.json({ text });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e?.message || e) });
  }
});

// Admin AI chat with DB context
app.post('/api/admin/ai/chat', requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    }
    const admin = (await pool.query('SELECT nom, prenom FROM admin WHERE id = $1', [req.user.adminId])).rows[0];
    // Load brief DB context: counts, recent demandes, totals by month (limited)
    const [{ rows: countDem } , { rows: recent }, { rows: totals }] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS n FROM demande'),
      pool.query('SELECT iddemande, nom, prenom, telephone, prix, statut, created_at FROM demande ORDER BY created_at DESC LIMIT 10'),
      pool.query("SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, SUM(prix)::numeric AS total_prix FROM demande GROUP BY 1 ORDER BY 1 DESC LIMIT 6")
    ]);
    const statsText = `Stats: Demandes totales=${countDem[0]?.n ?? 0}. Dernières demandes: ${recent.map(r => `${r.iddemande} ${r.nom} ${r.prenom} ${r.prix}DH ${r.statut}`).join(' | ')}. Totaux mensuels: ${totals.map(t => `${t.month}:${t.total_prix}DH`).join(' / ')}.`;

    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    // If user requests downloadable links for quotes, generate them directly
    const lastMsg = String(messages[messages.length - 1]?.content || '').toLowerCase();
    const wantsLinks = /(télécharg|telecharg|lien|liens).*(devis|pdf)/.test(lastMsg);
    if (wantsLinks) {
      // Try to extract dates (YYYY-MM-DD or DD/MM/YYYY); else default last 30 days
      function parseDateToken(s) {
        s = s.trim();
        const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
        if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
        const fr = s.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
        if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
        return null;
      }
      const tokens = lastMsg.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/g) || [];
      let from = null, to = null;
      if (tokens.length >= 2) { from = parseDateToken(tokens[0]); to = parseDateToken(tokens[1]); }
      if (!from || !to) {
        const end = new Date();
        const start = new Date(Date.now() - 30*24*60*60*1000);
        const pad = (n) => String(n).padStart(2,'0');
        to = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}`;
        from = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`;
      }
      // Generate and fetch links as in export endpoint
      const { rows } = await pool.query('SELECT iddemande, pdf_path FROM demande WHERE created_at::date BETWEEN $1::date AND $2::date ORDER BY created_at ASC', [from, to]);
      for (const d of rows) {
        if (!d.pdf_path) {
          try {
            await fetch(`${req.protocol}://${req.get('host')}/api/demandes/${d.iddemande}/pdf`, { method: 'POST' });
          } catch {}
        }
      }
      const { rows: finalRows } = await pool.query('SELECT iddemande, pdf_path FROM demande WHERE created_at::date BETWEEN $1::date AND $2::date ORDER BY created_at ASC', [from, to]);
      const links = finalRows.filter(r => r.pdf_path);
      const base = `${req.protocol}://${req.get('host')}`;
      const listText = links.length ? links.map(r => `• ${base}${r.pdf_path} (ID ${r.iddemande})`).join('\n') : 'Aucun devis trouvé pour cette période.';
      const text = `Voici les liens de téléchargement des devis pour la période ${from} → ${to} :\n${listText}`;
      const listHtml = links.length ? links.map(r => `<div>• <a href="${base}${r.pdf_path}" target="_blank" rel="noopener">${r.iddemande}</a></div>`).join('') : '<div>Aucun devis trouvé pour cette période.</div>';
      const html = `<div><strong>Liens de téléchargement des devis</strong> <span style="color:#6b7280">(${from} → ${to})</span></div>${listHtml}`;
      // If asked to send to a sector (finance/chantier/production), broadcast notification
      const sectorMatch = lastMsg.match(/(envoy|send).*\b(finance|chantier|production)\b/);
      if (sectorMatch) {
        const sect = sectorMatch[2];
        const bodyHtml = `${html}<div style=\"margin-top:6px;color:#64748b;\">Message automatique: liens de devis envoyés par l\'assistant admin.</div>`;
        const emps = (await pool.query('SELECT id FROM employee WHERE secteur = $1', [sect]))?.rows || [];
        for (const e of emps) {
          await pool.query('INSERT INTO notification (employee_id, title, body_html) VALUES ($1,$2,$3)', [e.id, `Liens de devis (${from} → ${to})`, bodyHtml]);
        }
      }
      return res.json({ text, html });
    }

    // Generic notification intent (custom message, with or without links)
    const wantsNotifyGeneric = /(notif|notification|envoi|envoy\w*)/.test(lastMsg) && /(finance|chantier|production)/.test(lastMsg);
    if (wantsNotifyGeneric) {
      const sectorMatch = lastMsg.match(/(finance|chantier|production)/);
      const sect = sectorMatch ? sectorMatch[1] : 'finance';
      // Try to extract custom message after keywords like "message:" or "instr:" or "texte:"
      let custom = null;
      const msgMatch = messages[messages.length - 1]?.content?.match(/(?:message|instr(?:uction)?|texte)\s*:\s*([\s\S]+)/i);
      if (msgMatch) custom = msgMatch[1].trim();
      // Optional date range and links even if not explicitly asking for links
      const tokens = lastMsg.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/g) || [];
      let from = null, to = null;
      if (tokens.length >= 2) {
        const parseDateToken = (s) => { s = s.trim(); const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`; const fr = s.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/); if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`; return null; };
        from = parseDateToken(tokens[0]); to = parseDateToken(tokens[1]);
      }
      let htmlParts = [];
      if (custom) htmlParts.push(`<div style=\"margin-bottom:8px;\">${custom}</div>`);
      if (from && to) {
        const { rows } = await pool.query('SELECT iddemande, pdf_path FROM demande WHERE created_at::date BETWEEN $1::date AND $2::date ORDER BY created_at ASC', [from, to]);
        for (const d of rows) {
          if (!d.pdf_path) { try { await fetch(`${req.protocol}://${req.get('host')}/api/demandes/${d.iddemande}/pdf`, { method: 'POST' }); } catch {} }
        }
        const { rows: finalRows } = await pool.query('SELECT iddemande, pdf_path FROM demande WHERE created_at::date BETWEEN $1::date AND $2::date ORDER BY created_at ASC', [from, to]);
        const links = finalRows.filter(r => r.pdf_path);
        const base = `${req.protocol}://${req.get('host')}`;
        const listHtml = links.length ? links.map(r => `<div>• <a href=\"${base}${r.pdf_path}\" target=\"_blank\" rel=\"noopener\">${r.iddemande}</a></div>`).join('') : '<div>Aucun devis trouvé pour cette période.</div>';
        htmlParts.push(`<div><strong>Liens de téléchargement des devis</strong> <span style=\"color:#6b7280\">(${from} → ${to})</span></div>${listHtml}`);
      }
      if (htmlParts.length === 0) {
        htmlParts.push('<div>(Aucun contenu à diffuser)</div>');
      }
      const bodyHtml = htmlParts.join('');
      const { rows: emps } = await pool.query('SELECT id FROM employee WHERE secteur = $1', [sect]);
      for (const e of emps) {
        await pool.query('INSERT INTO notification (employee_id, title, body_html) VALUES ($1,$2,$3)', [e.id, custom ? 'Instruction' : 'Notification', bodyHtml]);
      }
      const confirmText = `Notification envoyée au secteur ${sect} (${emps.length} destinataires).`;
      const confirmHtml = `<div><strong>${confirmText}</strong></div>`;
      return res.json({ text: confirmText, html: confirmHtml });
    }
    const preamble = `Tu es l'assistant business de Zalagh Plancher. Adresse-toi à l'administrateur ${admin?.nom || ''} ${admin?.prenom || ''}. Réponds en français et applique ces règles: \n- Titre court en <strong>\n- Listes à puces quand pertinent\n- Sauts de ligne avec <br/>\n- Mots/nombres clés en <strong>\n- Quand on te demande des LIENS DEVIS: retourne aussi un fragment HTML avec des <a> cliquables.\n- Si on demande d'envoyer les devis au service finance: répond OK et propose une période; le serveur s'occupera de la notification. ${statsText}`;
    const contents = [];
    contents.push({ role: 'user', parts: [{ text: preamble }] });
    for (const m of messages) {
      const role = m.role === 'assistant' ? 'model' : 'user';
      contents.push({ role, parts: [{ text: String(m.content || '') }] });
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const body = { contents };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('Gemini admin chat error', r.status, errText);
      return res.status(500).json({ error: 'Gemini admin chat failed', status: r.status, details: errText });
    }
    const data = await r.json();
    let text = '';
    try { text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || ''; } catch {}
    return res.json({ text });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e?.message || e) });
  }
});

// Export PDF links between dates (inclusive)
app.get('/api/admin/export', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to (YYYY-MM-DD) required' });
    const { rows } = await pool.query('SELECT iddemande, pdf_path FROM demande WHERE created_at::date BETWEEN $1::date AND $2::date ORDER BY created_at ASC', [from, to]);
    // Generate missing PDFs on the fly
    for (const d of rows) {
      if (!d.pdf_path) {
        try {
          await fetch(`${req.protocol}://${req.get('host')}/api/demandes/${d.iddemande}/pdf`, { method: 'POST' });
        } catch {}
      }
    }
    const { rows: finalRows } = await pool.query('SELECT iddemande, pdf_path FROM demande WHERE created_at::date BETWEEN $1::date AND $2::date ORDER BY created_at ASC', [from, to]);
    res.json({ items: finalRows.filter(r => r.pdf_path) });
  } catch (e) {
    res.status(500).json({ error: 'Server error', details: String(e?.message || e) });
  }
});

// Create demande from chatbot estimation (no auth)
app.post('/api/ai/request-quote', async (req, res) => {
  try {
    const { nom, prenom, telephone, type_projet, prix, plan_jpg } = req.body || {};
    if (!nom || !prenom || !type_projet || (prix === undefined || prix === null)) {
      return res.status(400).json({ error: 'nom, prenom, type_projet, prix required' });
    }
    // plan_jpg is optional; when provided must be under /planjpg/
    let storedPlan = null;
    if (typeof plan_jpg === 'string' && plan_jpg.trim() !== '') {
      if (!plan_jpg.startsWith('/planjpg/')) {
        return res.status(400).json({ error: 'invalid plan_jpg path' });
      }
      storedPlan = plan_jpg.replace(/^\/+/, '');
    }
    const st = 'encours';
    const { rows } = await pool.query(
      `INSERT INTO demande (nom, prenom, telephone, type_projet, plan_jpg, prix, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nom, prenom, telephone || null, type_projet, storedPlan, prix, st]
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e?.message || e) });
  }
});

// Upload a plan image from chatbot form and return a public /planjpg path
app.post('/api/plan/upload', upload.single('plan'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'plan file required' });
    const srcPath = path.join(uploadsDir, req.file.filename);
    const safeName = req.file.originalname ? req.file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_') : `${Date.now()}.jpg`;
    const finalName = `${Date.now()}_${safeName}`;
    const destPath = path.join(planjpgDir, finalName);
    try { fs.copyFileSync(srcPath, destPath); } catch {}
    try { fs.unlinkSync(srcPath); } catch {}
    const publicPath = `/planjpg/${finalName}`;
    return res.json({ plan_jpg: publicPath });
  } catch (e) {
    return res.status(500).json({ error: 'Upload failed', details: String(e?.message || e) });
  }
});

const port = process.env.PORT || 8080;
runMigrationsAndSeed()
  .then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`Server listening on port ${port}`));
  })
  .catch((err) => {
    console.error('Failed to init db', err);
    process.exit(1);
  });


