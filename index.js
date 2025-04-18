require('dotenv').config();

const express  = require('express');
const session  = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path     = require('path');

const app = express();

const mongoose = require('mongoose');
const pageRoutes = require('./routes/pages');
app.use('/api/pages', pageRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

  
/* ───── Session ───── */
app.use(session({
  secret: 'your_session_secret',
  resave: false,
  saveUninitialized: true
}));

/* ───── Passport ───── */
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL
    },
    (accessToken, refreshToken, profile, done) => {
      const email        = profile.emails[0].value;
      const allowedEmail = process.env.ALLOWED_EMAIL;
      if (email !== allowedEmail) return done(null, false); // ไม่อนุญาต
      done(null, profile);                                  // ผ่าน
    }
  )
);

/* ───── ตัวช่วยตรวจ Auth ───── */
function ensureAuthenticated(req, res, next) {
  return req.isAuthenticated() ? next() : res.redirect('/');
}

/* ───── เสิร์ฟไฟล์ static ───── */
app.use(express.static(path.join(__dirname, 'public')));

/* ───── Routes ปกติ ───── */
app.get('/', (req, res) => {
  req.isAuthenticated()
    ? res.redirect('/home')
    : res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/home', ensureAuthenticated, (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'home.html'))
);

app.get('/user-info', ensureAuthenticated, (req, res) =>
  res.json({
    displayName: req.user.displayName,
    email:       req.user.emails[0].value
  })
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

/* ───── ❶ catch‑all สำหรับ /<slug> ─────
   * ต้องวาง **หลัง** express.static และ **หลัง** route ด้านบน
   * แต่ก่อน app.listen
*/
app.get('/:slug', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sale.html'));
});

app.get('/:slug/policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'policy.html'));
});

/* ───── start server ───── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
