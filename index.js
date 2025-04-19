require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const Page = require('./models/Page');

const app = express();

// ✅ เชื่อมต่อ MongoDB
mongoose.connect(process.env.MONGO_URI);

// ✅ Middleware พื้นฐาน
app.use(session({
  secret: 'your_session_secret',
  resave: false,
  saveUninitialized: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(passport.initialize());
app.use(passport.session());

// ✅ Google OAuth
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
  if (profile.emails[0].value !== process.env.ALLOWED_EMAIL) return done(null, false);
  done(null, profile);
}));

function ensureAuthenticated(req, res, next) {
  return req.isAuthenticated() ? next() : res.redirect('/');
}

// ✅ ตรวจสอบซับโดเมนแล้วเสิร์ฟเพจ
app.use(async (req, res, next) => {
  const host = req.hostname.toLowerCase();
  const base = process.env.BASE_DOMAIN?.toLowerCase();

  if (base && host.endsWith(base)) {
    const sub = host.replace(`.${base}`, '');
    req.slugFromSubdomain = sub;
    if (sub && sub !== 'www') {
      const page = await Page.findOne({ slug: sub });
      if (page) {
        if (req.path === '/' || req.path === '') {
          return res.sendFile(path.join(__dirname, 'public/sale.html'));
        }
        if (req.path === '/policy' && page.policy) {
          return res.sendFile(path.join(__dirname, 'public/policy.html'));
        }
        return res.status(404).send('ไม่พบหน้าที่ร้องขอ');
      }
    }
  }

  next();
});

// ✅ Static Files
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Routes
app.get('/', (req, res) => {
  req.isAuthenticated()
    ? res.redirect('/home')
    : res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.get('/home', ensureAuthenticated, (_req, res) =>
  res.sendFile(path.join(__dirname, 'public/home.html'))
);

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=unauthorized' }),
  (_req, res) => res.redirect('/home')
);

app.get('/logout', (req, res, next) => {
  req.logout(err => (err ? next(err) : res.redirect('/')));
});

app.get('/user-info', ensureAuthenticated, (req, res) =>
  res.json({
    displayName: req.user.displayName,
    email: req.user.emails[0].value
  })
);

// ✅ API - Pages
app.get('/api/pages', ensureAuthenticated, async (req, res) => {
  const pages = await Page.find({ owner: req.user.emails[0].value });
  res.json(pages);
});

app.post('/api/pages', ensureAuthenticated, async (req, res) => {
  const data = req.body;
  const email = req.user.emails[0].value;
  data.owner = email;

  try {
    const existSlug = await Page.findOne({ slug: data.slug, owner: email, id: { $ne: data.id } });
    if (existSlug) return res.status(400).json({ error: 'slug นี้ถูกใช้แล้ว' });

    const existName = await Page.findOne({ name: data.name, owner: email, id: { $ne: data.id } });
    if (existName) return res.status(400).json({ error: 'ชื่อเพจนี้มีอยู่แล้ว' });

    await Page.findOneAndUpdate({ id: data.id }, data, { upsert: true });
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error saving page:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.delete('/api/pages/:id', ensureAuthenticated, async (req, res) => {
  await Page.deleteOne({ id: req.params.id, owner: req.user.emails[0].value });
  res.sendStatus(200);
});

app.get('/api/page/:slug', async (req, res) => {
  const slug = req.params.slug || req.slugFromSubdomain;
  const page = await Page.findOne({ slug });
  if (!page) return res.status(404).json({ error: 'not found' });
  res.json(page);
});

// ✅ Fallback สำหรับ path-based URL
app.get('/:slug', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public/sale.html'))
);

app.get('/:slug/policy', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public/policy.html'))
);

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
