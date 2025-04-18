require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const Page = require('./models/Page');

const app = express();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.use(session({
  secret: 'your_session_secret',
  resave: false,
  saveUninitialized: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

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

app.use(express.static(path.join(__dirname, 'public')));

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

// ───── API (MongoDB) ─────
app.get('/api/pages', ensureAuthenticated, async (req, res) => {
  const pages = await Page.find({ owner: req.user.emails[0].value });
  res.json(pages);
});

app.post('/api/pages', ensureAuthenticated, async (req, res) => {
  const data = req.body;
  const email = req.user.emails[0].value;
  data.owner = email;

  try {
    // ตรวจสอบว่ามี slug ซ้ำไหม (ยกเว้นตัวเดิม)
    const existSlug = await Page.findOne({ slug: data.slug, owner: email, id: { $ne: data.id } });
    if (existSlug) return res.status(400).json({ error: 'slug นี้ถูกใช้แล้ว' });

    // ตรวจสอบว่ามีชื่อซ้ำไหม (ยกเว้นตัวเดิม)
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
  const page = await Page.findOne({ slug: req.params.slug });
  if (!page) return res.status(404).json({ error: 'not found' });
  res.json(page);
});

// ───── Serve sale page ─────
app.get('/:slug', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/sale.html'));
});

app.get('/:slug/policy', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/policy.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
