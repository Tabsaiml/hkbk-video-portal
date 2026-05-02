// ================================================================
//  HKBK Video Library — server.js
//  Run: node server.js  →  http://localhost:5500
// ================================================================

const express    = require('express');
const multer     = require('multer');
const Datastore  = require('@seald-io/nedb');
const path       = require('path');
const fs         = require('fs');
const bcrypt     = require('bcryptjs');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = 5500;

// ── Email config — swap to college SMTP when ready ───────────────
const EMAIL_CONFIG = {
  host    : 'smtp.gmail.com',   // Change to: mail.hkbk.edu.in
  port    : 587,                // Change to college port if needed
  secure  : false,              // true for port 465
  user    : 'hod.aiml@hkbk.edu.in',
  pass    : 'mrhinafzkhcekzgo',
  from    : '"HKBK Video Library" <hod.aiml@hkbk.edu.in>'
};

// ── Email transporter ────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host             : EMAIL_CONFIG.host,
  port             : EMAIL_CONFIG.port,
  secure           : EMAIL_CONFIG.secure,
  auth             : { user: EMAIL_CONFIG.user, pass: EMAIL_CONFIG.pass },
  connectionTimeout: 4000,   // fail after 4 seconds
  greetingTimeout  : 4000,
  socketTimeout    : 4000,
});

// ── Databases ────────────────────────────────────────────────────
const DB = f => path.join(__dirname, 'data', f);
const videosDB  = new Datastore({ filename: DB('videos.db'),   autoload: true });
const usersDB   = new Datastore({ filename: DB('users.db'),    autoload: true });
const sessionsDB = new Datastore({ filename: DB('sessions.db'), autoload: true });
const otpDB     = new Datastore({ filename: DB('otps.db'),     autoload: true });

usersDB.ensureIndex({ fieldName: 'email', unique: true });

// ── Seed admin account on first run ─────────────────────────────
usersDB.findOne({ role: 'admin' }, (err, doc) => {
  if (!doc) {
    bcrypt.hash('Admin@1234', 10, (e, hash) => {
      usersDB.insert({ _id: uuidv4(), name: 'Admin', email: 'admin@hkbk.edu.in', password: hash, role: 'admin', createdAt: new Date() });
      console.log('Admin created → email: admin@hkbk.edu.in  password: Admin@1234');
    });
  }
});

// ── Multer ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads', 'videos')),
  filename:    (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    /mp4|mov|avi|mkv|webm|m4v/i.test(path.extname(file.originalname))
      ? cb(null, true) : cb(new Error('Only video files allowed'));
  }
});

// ── Middleware ────────────────────────────────────────────────────
app.use(express.json());
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use(express.static(path.join(__dirname, 'public')));

// ── Public counts (no auth needed) ───────────────────────────────
app.get('/api/counts', (req, res) => {
  usersDB.count({ role: { $ne: 'admin' } }, (e1, userCount) => {
    videosDB.count({}, (e2, videoCount) => {
      res.json({ users: userCount || 0, videos: videoCount || 0 });
    });
  });
});

// ── Auth helpers ─────────────────────────────────────────────────
function getSession(req, cb) {
  const token = req.headers['x-auth-token'];
  if (!token) return cb(null, null);
  sessionsDB.findOne({ token }, (err, session) => {
    if (err || !session) return cb(null, null);
    usersDB.findOne({ _id: session.userId }, (e, user) => cb(null, user));
  });
}

function requireAuth(req, res, next) {
  getSession(req, (err, user) => {
    if (!user) return res.status(401).json({ error: 'Login required' });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  getSession(req, (err, user) => {
    if (!user) return res.status(401).json({ error: 'Login required' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.user = user;
    next();
  });
}

// ── Email helpers ────────────────────────────────────────────────

// Detect role from email pattern
function detectRole(email) {
  const local = email.split('@')[0].toLowerCase();
  // Students: 1hk23AI004, 1hk24CS045 — starts with 1hk + 2 digits
  if (/^1hk\d{2}/.test(local)) return 'student';
  // Faculty/employees: dean.iic, principal, afreenk.aiml
  return 'faculty';
}

// Validate only @hkbk.edu.in emails allowed
function isHKBKEmail(email) {
  return email.toLowerCase().endsWith('@hkbk.edu.in');
}

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email
async function sendOTPEmail(email, otp, name) {
  const role = detectRole(email);
  const roleText = role === 'student' ? 'Student' : 'Faculty/Staff';
  await transporter.sendMail({
    from   : EMAIL_CONFIG.from,
    to     : email,
    subject: 'HKBK Video Library — Email Verification Code',
    html   : `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f5f5f5;padding:20px;border-radius:10px">
        <div style="background:#1565c0;padding:20px;border-radius:8px 8px 0 0;text-align:center">
          <h2 style="color:#fff;margin:0">🎬 HKBK Video Library</h2>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 8px 8px">
          <p style="color:#333;font-size:15px">Hello <b>${name}</b>,</p>
          <p style="color:#555;font-size:14px">Your verification code for <b>${roleText}</b> account registration is:</p>
          <div style="background:#f0f4ff;border:2px dashed #1565c0;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
            <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1565c0">${otp}</span>
          </div>
          <p style="color:#888;font-size:12px">This code expires in <b>10 minutes</b>. Do not share it with anyone.</p>
          <p style="color:#888;font-size:12px">If you did not request this, ignore this email.</p>
        </div>
      </div>`
  });
}

// ── AUTH ROUTES ──────────────────────────────────────────────────

// Send OTP — step 1 of registration
app.post('/api/send-otp', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (!isHKBKEmail(email)) return res.status(400).json({ error: 'Only @hkbk.edu.in email addresses are allowed' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  // Check if email already registered
  usersDB.findOne({ email: email.trim().toLowerCase() }, async (err, existing) => {
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const otp     = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP with registration details
    otpDB.remove({ email: email.toLowerCase() }, { multi: true }, () => {
      otpDB.insert({ email: email.toLowerCase(), otp, name: name.trim(), password, expires }, async (e) => {
        if (e) return res.status(500).json({ error: 'Server error' });
        // Print OTP to terminal (remove this after email is configured)
        console.log(`\n📧 OTP for ${email}: ${otp}\n`);
        try {
          await sendOTPEmail(email, otp, name.trim());
        } catch (mailErr) {
          console.log('Email send failed (use OTP from terminal above):', mailErr.message);
        }
        res.json({ success: true, message: `Verification code sent to ${email}` });
      });
    });
  });
});

// Verify OTP — step 2 of registration
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  otpDB.findOne({ email: email.toLowerCase(), otp }, (err, record) => {
    if (err || !record) return res.status(400).json({ error: 'Invalid verification code' });
    if (new Date() > new Date(record.expires)) {
      otpDB.remove({ email: email.toLowerCase() }, { multi: true }, () => {});
      return res.status(400).json({ error: 'Verification code expired. Please register again.' });
    }

    // OTP valid — create user account
    bcrypt.hash(record.password, 10, (e, hash) => {
      if (e) return res.status(500).json({ error: 'Server error' });
      const role     = detectRole(email);
      const canUpload = role === 'faculty';
      const user = {
        _id      : uuidv4(),
        name     : record.name,
        email    : email.toLowerCase(),
        password : hash,
        role     : 'user',
        userType : role,         // 'student' or 'faculty'
        canUpload: canUpload,
        status   : 'pending',   // admin must approve
        createdAt: new Date()
      };
      usersDB.insert(user, (insertErr) => {
        if (insertErr) return res.status(400).json({ error: 'Email already registered' });
        otpDB.remove({ email: email.toLowerCase() }, { multi: true }, () => {});
        res.json({
          success : true,
          pending : true,
          userType: role,
          message : `Email verified! Your ${role} account is awaiting admin approval.`
        });
      });
    });
  });
});

// Register
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    const user = { _id: uuidv4(), name: name.trim(), email: email.trim().toLowerCase(), password: hash, role: 'user', status: 'pending', createdAt: new Date() };
    usersDB.insert(user, (e, newUser) => {
      if (e) return res.status(400).json({ error: 'Email already registered' });
      // Do NOT create session — user must wait for admin approval
      res.json({ success: true, pending: true, message: 'Registration successful! Your account is awaiting admin approval. You will be able to login once approved.' });
    });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  usersDB.findOne({ email: email.trim().toLowerCase() }, (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Invalid email or password' });
    bcrypt.compare(password, user.password, (e, match) => {
      if (!match) return res.status(401).json({ error: 'Invalid email or password' });
      // Check if account is approved (admin always passes; undefined status = legacy user = approved)
      if (user.role !== 'admin' && user.status === 'pending') {
        return res.status(403).json({ error: 'Your account is pending admin approval. Please wait.' });
      }
      const token = uuidv4();
      sessionsDB.insert({ token, userId: user._id, createdAt: new Date() }, () => {
        res.json({ success: true, token, user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
      });
    });
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) sessionsDB.remove({ token }, {}, () => {});
  res.json({ success: true });
});

// Me
app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    _id      : req.user._id,
    name     : req.user.name,
    email    : req.user.email,
    role     : req.user.role,
    userType : req.user.userType || 'faculty',
    canUpload: req.user.canUpload !== false
  });
});

// Admin: get all users
app.get('/api/users', requireAdmin, (req, res) => {
  usersDB.find({}).sort({ createdAt: -1 }).exec((err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users.map(u => ({ _id: u._id, name: u.name, email: u.email, role: u.role, status: u.status || 'approved', createdAt: u.createdAt })));
  });
});

// Admin: get pending users (two routes for compatibility)
app.get('/api/users/pending', requireAdmin, (req, res) => {
  usersDB.find({ status: 'pending' }).sort({ createdAt: -1 }).exec((err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ users: users.map(u => ({ _id: u._id, name: u.name, email: u.email, userType: u.userType || 'faculty', createdAt: u.createdAt })) });
  });
});
app.get('/api/pending-users', requireAdmin, (req, res) => {
  usersDB.find({ status: 'pending' }).sort({ createdAt: -1 }).exec((err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users.map(u => ({ _id: u._id, name: u.name, email: u.email, createdAt: u.createdAt })));
  });
});

// Admin: approve user
app.post('/api/users/:id/approve', requireAdmin, (req, res) => {
  usersDB.update({ _id: req.params.id }, { $set: { status: 'approved' } }, {}, (err, n) => {
    if (err || !n) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  });
});

// Admin: reject/delete user
app.delete('/api/users/:id', requireAdmin, (req, res) => {
  if (req.params.id === req.user._id) return res.status(400).json({ error: 'Cannot delete yourself' });
  usersDB.remove({ _id: req.params.id }, {}, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    sessionsDB.remove({ userId: req.params.id }, { multi: true }, () => {});
    res.json({ success: true });
  });
});

// ── VIDEO STREAMING ──────────────────────────────────────────────
app.get('/stream/:filename', (req, res, next) => {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (!token) return res.status(401).send('Login required');
  sessionsDB.findOne({ token }, (err, session) => {
    if (err || !session) return res.status(401).send('Login required');
    next();
  });
}, (req, res) => {
  const filePath = path.join(__dirname, 'uploads/videos', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  const stat  = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : Math.min(start + 10 * 1024 * 1024, total - 1);
    res.writeHead(206, {
      'Content-Range' : `bytes ${start}-${end}/${total}`,
      'Accept-Ranges' : 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type'  : 'video/mp4'
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': total, 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' });
    fs.createReadStream(filePath).pipe(res);
  }
});

// ── VIDEO ROUTES ─────────────────────────────────────────────────

// Upload — faculty and admin only
app.post('/api/upload', requireAuth, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video file' });
  if (req.user.userType === 'student') return res.status(403).json({ error: 'Students can only watch videos. Upload is for faculty only.' });
  const { title, description, topic } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const doc = {
    _id: uuidv4(), title: title.trim(),
    description: (description || '').trim(),
    uploader: req.user.name,
    uploaderId: req.user._id,
    topic: (topic || 'General').trim(),
    filename: req.file.filename,
    size: req.file.size,
    views: 0, likes: 0,
    status: req.user.role === 'admin' ? 'approved' : 'pending', // admin videos auto-approved
    uploadedAt: new Date()
  };
  videosDB.insert(doc, (err, newDoc) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, video: newDoc });
  });
});

// Get all videos — users only see approved, admin sees all
app.get('/api/videos', requireAuth, (req, res) => {
  const page   = parseInt(req.query.page  || 1);
  const limit  = parseInt(req.query.limit || 12);
  const sortBy = req.query.sort;
  const sort   = sortBy === 'popular' ? { views: -1 } : { uploadedAt: -1 };
  const filter = req.user.role === 'admin' ? {} : { status: 'approved' };

  if (sortBy === 'all') {
    // Return all videos, no pagination
    videosDB.find(filter).sort({ uploadedAt: -1 }).exec((err, docs) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ videos: docs, total: docs.length, page: 1, pages: 1 });
    });
    return;
  }

  videosDB.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).exec((err, docs) => {
    if (err) return res.status(500).json({ error: err.message });
    videosDB.count(filter, (e, total) => {
      res.json({ videos: docs, total, page, pages: Math.ceil(total / limit) });
    });
  });
});

// Admin: pending videos
app.get('/api/pending', requireAdmin, (req, res) => {
  videosDB.find({ status: 'pending' }).sort({ uploadedAt: -1 }).exec((err, docs) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ videos: docs });
  });
});

// Admin: approve video
app.post('/api/videos/:id/approve', requireAdmin, (req, res) => {
  videosDB.update({ _id: req.params.id }, { $set: { status: 'approved' } }, {}, (err, n) => {
    if (err || !n) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });
});

// Admin: reject video
app.post('/api/videos/:id/reject', requireAdmin, (req, res) => {
  videosDB.findOne({ _id: req.params.id }, (err, doc) => {
    if (err || !doc) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(__dirname, 'uploads/videos', doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    videosDB.remove({ _id: req.params.id }, {}, () => res.json({ success: true }));
  });
});

// Get single video
app.get('/api/videos/:id', requireAuth, (req, res) => {
  videosDB.findOne({ _id: req.params.id }, (err, doc) => {
    if (err || !doc) return res.status(404).json({ error: 'Not found' });
    videosDB.update({ _id: req.params.id }, { $inc: { views: 1 } }, {}, () => {});
    res.json({ ...doc, views: doc.views + 1 });
  });
});

// Like
app.post('/api/videos/:id/like', requireAuth, (req, res) => {
  videosDB.update({ _id: req.params.id }, { $inc: { likes: 1 } }, {}, (err, n) => {
    if (err || !n) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });
});

// Search
app.get('/api/search', requireAuth, (req, res) => {
  const q    = (req.query.q || '').trim();
  const type = req.query.type || 'all';
  if (!q) return res.json({ videos: [] });
  const regex  = new RegExp(q, 'i');
  const statusFilter = req.user.role === 'admin' ? {} : { status: 'approved' };
  let query;
  if (type === 'person')      query = { uploader: regex, ...statusFilter };
  else if (type === 'topic')  query = { topic: regex, ...statusFilter };
  else if (type === 'title')  query = { title: regex, ...statusFilter };
  else query = { $or: [{ title: regex }, { uploader: regex }, { topic: regex }, { description: regex }], ...statusFilter };
  videosDB.find(query).sort({ views: -1 }).limit(50).exec((err, docs) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ videos: docs, query: q, type });
  });
});

// Stats
app.get('/api/stats', requireAuth, (req, res) => {
  videosDB.find({}, (err, all) => {
    if (err) return res.status(500).json({ error: err.message });
    const totalVideos = all.length;
    const totalViews  = all.reduce((s, v) => s + v.views, 0);
    const totalLikes  = all.reduce((s, v) => s + v.likes, 0);
    const totalSize   = all.reduce((s, v) => s + v.size,  0);
    const topVideos   = [...all].sort((a, b) => b.views - a.views).slice(0, 5)
      .map(v => ({ _id: v._id, title: v.title, views: v.views, uploader: v.uploader }));
    const uploaderMap = {};
    all.forEach(v => {
      if (!uploaderMap[v.uploader]) uploaderMap[v.uploader] = { name: v.uploader, videos: 0, views: 0 };
      uploaderMap[v.uploader].videos++;
      uploaderMap[v.uploader].views += v.views;
    });
    const topUploaders = Object.values(uploaderMap).sort((a, b) => b.videos - a.videos).slice(0, 5);
    const topicMap = {};
    all.forEach(v => { topicMap[v.topic] = (topicMap[v.topic] || 0) + 1; });
    const topics = Object.entries(topicMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const since = new Date(Date.now() - 7 * 86400 * 1000);
    const recentCount = all.filter(v => new Date(v.uploadedAt) > since).length;

    const statsData = { totalVideos, totalViews, totalLikes, totalSize, topVideos, topUploaders, topics, recentCount };

    // Admin also gets user count
    if (req.user.role === 'admin') {
      usersDB.count({}, (e, userCount) => {
        res.json({ ...statsData, userCount });
      });
    } else {
      res.json(statsData);
    }
  });
});

// User video statistics — per user upload details with dates
app.get('/api/user-stats', requireAuth, (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { status: 'approved' };
  videosDB.find(filter).sort({ uploadedAt: -1 }).exec((err, all) => {
    if (err) return res.status(500).json({ error: err.message });

    // Group videos by uploader
    const userMap = {};
    all.forEach(v => {
      if (!userMap[v.uploader]) {
        userMap[v.uploader] = {
          name      : v.uploader,
          uploaderId: v.uploaderId,
          totalVideos: 0,
          totalViews : 0,
          totalLikes : 0,
          videos     : []
        };
      }
      userMap[v.uploader].totalVideos++;
      userMap[v.uploader].totalViews  += v.views;
      userMap[v.uploader].totalLikes  += v.likes;
      userMap[v.uploader].videos.push({
        _id       : v._id,
        title     : v.title,
        topic     : v.topic,
        views     : v.views,
        likes     : v.likes,
        status    : v.status,
        uploadedAt: v.uploadedAt
      });
    });

    const result = Object.values(userMap).sort((a, b) => b.totalVideos - a.totalVideos);
    res.json(result);
  });
});

// Delete video — admin only
app.delete('/api/videos/:id', requireAdmin, (req, res) => {
  videosDB.findOne({ _id: req.params.id }, (err, doc) => {
    if (err || !doc) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(__dirname, 'uploads/videos', doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    videosDB.remove({ _id: req.params.id }, {}, (e) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json({ success: true });
    });
  });
});

// My videos
app.get('/api/my-videos', requireAuth, (req, res) => {
  videosDB.find({ uploaderId: req.user._id }).sort({ uploadedAt: -1 }).exec((err, docs) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ videos: docs });
  });
});

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎬 HKBK Video Library running at http://localhost:${PORT}\n`);
});
