// ================================================================
//  HKBK Video Library — server.js
//  Run: node server.js  →  http://localhost:5500
// ================================================================

const express  = require('express');
const multer   = require('multer');
const Datastore = require('@seald-io/nedb');
const path     = require('path');
const fs       = require('fs');
const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = 5500;

// ── Databases ────────────────────────────────────────────────────
const videosDB  = new Datastore({ filename: './data/videos.db',  autoload: true });
const usersDB   = new Datastore({ filename: './data/users.db',   autoload: true });
const sessionsDB = new Datastore({ filename: './data/sessions.db', autoload: true });

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
  destination: (req, file, cb) => cb(null, './uploads/videos/'),
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
app.use(express.static('public'));

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

// ── AUTH ROUTES ──────────────────────────────────────────────────

// Register
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    const user = { _id: uuidv4(), name: name.trim(), email: email.trim().toLowerCase(), password: hash, role: 'user', createdAt: new Date() };
    usersDB.insert(user, (e, newUser) => {
      if (e) return res.status(400).json({ error: 'Email already registered' });
      const token = uuidv4();
      sessionsDB.insert({ token, userId: newUser._id, createdAt: new Date() }, () => {
        res.json({ success: true, token, user: { _id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role } });
      });
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
  res.json({ _id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role });
});

// Admin: get all users
app.get('/api/users', requireAdmin, (req, res) => {
  usersDB.find({}).sort({ createdAt: -1 }).exec((err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users.map(u => ({ _id: u._id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt })));
  });
});

// Admin: delete user
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

// Upload
app.post('/api/upload', requireAuth, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video file' });
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
  const sort   = req.query.sort === 'popular' ? { views: -1 } : { uploadedAt: -1 };
  const filter = req.user.role === 'admin' ? {} : { status: 'approved' };

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

// Delete video — admin can delete any, user can delete own
app.delete('/api/videos/:id', requireAuth, (req, res) => {
  videosDB.findOne({ _id: req.params.id }, (err, doc) => {
    if (err || !doc) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && doc.uploaderId !== req.user._id)
      return res.status(403).json({ error: 'Not allowed' });
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

app.listen(PORT, () => {
  console.log(`\n🎬 HKBK Video Library running at http://localhost:${PORT}\n`);
});
