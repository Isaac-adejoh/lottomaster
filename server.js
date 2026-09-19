require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
// Trust proxy (Render sits behind a proxy — needed for real client IP)
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lotto_db';

mongoose.connect(MONGODB_URI).then(() => {
  console.log('✅ MongoDB connected');
}).catch(err => {
  console.error('❌ MongoDB error:', err.message);
});

// ============ SCHEMAS ============
const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  password: String,
  status: { type: String, default: 'pending' },
  verified: { type: Boolean, default: false },
  balance: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  totalBets: { type: Number, default: 0 },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: String, default: null },
  legalName: String,
  dateOfBirth: Date,
  homeAddress: String,
  age: Number,
  vipTier: { type: String, default: 'Bronze' },
  commissionBalance: { type: Number, default: 0 },
  totalCommissionEarned: { type: Number, default: 0 },
  sessionToken: { type: String, default: null },
  lastDailyClaim: { type: Date, default: null },
  wheelSpinCount: { type: Number, default: 0 },
  wheelLastWon: { type: Object, default: {} },
  coinSpinCount: { type: Number, default: 0 },
  coinLastWon: { type: Object, default: {} },
  cardSpinCount: { type: Number, default: 0 },
  cardLastWon: { type: Object, default: {} },
  boxSpinCount: { type: Number, default: 0 },
  boxLastWon: { type: Object, default: {} },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const winningCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  reward: { type: Number, required: true },
  expiry: Date,
  createdBy: String,
  createdAt: { type: Date, default: Date.now }
});

const entrySchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  username: String,
  game: String,
  code: String,
  matches: Number,
  rewardWon: Number,
  stake: Number,
  date: { type: Date, default: Date.now }
});

const withdrawalSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  username: String,
  amount: Number,
  method: String,
  address: String,
  speed: String,
  fee: Number,
  status: { type: String, default: 'pending' },
  requestedAt: { type: Date, default: Date.now }
});

const depositSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  username: String,
  amount: Number,
  method: String,
  transactionId: String,
  status: { type: String, default: 'pending' },
  requestedAt: { type: Date, default: Date.now }
});

const adminSchema = new mongoose.Schema({
  username: String, password: String, email: String
});

// Admin trusted device schema (max 2 approved)
const adminDeviceSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, index: true },
  deviceId: { type: String, required: true },
  label: { type: String, default: '' },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  status: { type: String, default: 'pending' },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  approvedAt: { type: Date, default: null }
});
adminDeviceSchema.index({ adminId: 1, deviceId: 1 }, { unique: true });

const achievementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, unique: true },
  achievements: [{ name: String, earnedAt: Date }]
});

const referralSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  referredUserId: mongoose.Schema.Types.ObjectId,
  commissionEarned: Number, status: String, createdAt: Date
});

const announcementSchema = new mongoose.Schema({
  title: String, message: String, createdBy: String,
  createdAt: { type: Date, default: Date.now }
});

const bonusSettingsSchema = new mongoose.Schema({
  rollsRequired: {
    double1: { type: Number, default: 30 }, double2: { type: Number, default: 25 },
    double3: { type: Number, default: 25 }, double4: { type: Number, default: 20 },
    double5: { type: Number, default: 15 }, double6: { type: Number, default: 50 }
  },
  bonusMultipliers: {
    double1: { type: Number, default: 8 }, double2: { type: Number, default: 6 },
    double3: { type: Number, default: 6 }, double4: { type: Number, default: 8 },
    double5: { type: Number, default: 10 }, double6: { type: Number, default: 25 }
  }
});

const randomRollRewardsSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  rewards: {
    sum3: { type: Number, default: 1.5 }, sum4: { type: Number, default: 1.5 },
    sum5: { type: Number, default: 2 }, sum6: { type: Number, default: 2 },
    sum7: { type: Number, default: 2.5 }, sum8: { type: Number, default: 2.5 },
    sum9: { type: Number, default: 3 }, sum10: { type: Number, default: 3 },
    sum11: { type: Number, default: 3.5 },
    consecutives: { type: Number, default: 2 }, sameParity: { type: Number, default: 1.5 }
  }
});

const paymentSettingsSchema = new mongoose.Schema({
  cryptoWallets: {
    usdt: { type: String, default: '' }, btc: { type: String, default: '' }
  },
  withdrawalFees: {
    standard: { type: Number, default: 0 }, express: { type: Number, default: 5 }, instant: { type: Number, default: 2 }
  },
  bankDetails: {
    bankName: { type: String, default: '' }, accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' }, routingNumber: { type: String, default: '' },
    swiftCode: { type: String, default: '' }
  }
});

const gameSettingsSchema = new mongoose.Schema({
  spinWheel: {
    enabled: { type: Boolean, default: true }, winProbability: { type: Number, default: 30 },
    payoutMultiplier: { type: Number, default: 3 }, forceOutcome: { type: String, default: 'auto' }
  },
  coinFlip: {
    enabled: { type: Boolean, default: true }, winProbability: { type: Number, default: 50 },
    payoutMultiplier: { type: Number, default: 2 }, forceOutcome: { type: String, default: 'auto' }
  },
  pickCard: {
    enabled: { type: Boolean, default: true }, winProbability: { type: Number, default: 25 },
    payoutMultiplier: { type: Number, default: 4 }, forceOutcome: { type: String, default: 'auto' }
  },
  pickBox: {
    enabled: { type: Boolean, default: true }, winProbability: { type: Number, default: 20 },
    payoutMultiplier: { type: Number, default: 5 }, forceOutcome: { type: String, default: 'auto' }
  }
});

const wheelSettingsSchema = new mongoose.Schema({
  segments: {
    type: [{
      label: { type: String, default: '$0' },
      multiplier: { type: Number, default: 0 },
      rollsRequired: { type: Number, default: 0 },
      isLoss: { type: Boolean, default: false }
    }],
    default: [
      { label: '$0',  multiplier: 0,  rollsRequired: 0,  isLoss: true },
      { label: '$5',  multiplier: 1.5, rollsRequired: 10, isLoss: false },
      { label: '$10', multiplier: 2,  rollsRequired: 15, isLoss: false },
      { label: '$15', multiplier: 3,  rollsRequired: 20, isLoss: false },
      { label: '$20', multiplier: 4,  rollsRequired: 25, isLoss: false },
      { label: '$30', multiplier: 6,  rollsRequired: 30, isLoss: false },
      { label: '$40', multiplier: 8,  rollsRequired: 40, isLoss: false },
      { label: '$50', multiplier: 10, rollsRequired: 50, isLoss: false },
      { label: '$70', multiplier: 15, rollsRequired: 70, isLoss: false },
      { label: '$0',  multiplier: 0,  rollsRequired: 0,  isLoss: true }
    ]
  }
});

const coinSettingsSchema = new mongoose.Schema({
  sides: {
    type: [{
      label: { type: String, default: 'Heads' },
      multiplier: { type: Number, default: 0 },
      rollsRequired: { type: Number, default: 0 },
      isLoss: { type: Boolean, default: false }
    }],
    default: [
      { label: 'Heads', multiplier: 2, rollsRequired: 5, isLoss: false },
      { label: 'Tails', multiplier: 0, rollsRequired: 0, isLoss: true }
    ]
  }
});

const cardSettingsSchema = new mongoose.Schema({
  cards: {
    type: [{
      label: { type: String, default: 'Card 1' },
      rank: { type: String, default: 'A' },
      suit: { type: String, default: '♠' },
      multiplier: { type: Number, default: 0 },
      rollsRequired: { type: Number, default: 0 },
      isLoss: { type: Boolean, default: false }
    }],
    default: [
      { label: 'Card 1', rank: 'A', suit: '♠', multiplier: 2, rollsRequired: 5,  isLoss: false },
      { label: 'Card 2', rank: 'K', suit: '♥', multiplier: 5, rollsRequired: 15, isLoss: false },
      { label: 'Card 3', rank: 'J', suit: '♦', multiplier: 0, rollsRequired: 0,  isLoss: true  },
      { label: 'Card 4', rank: 'Q', suit: '♣', multiplier: 3, rollsRequired: 10, isLoss: false }
    ]
  }
});

const boxSettingsSchema = new mongoose.Schema({
  boxes: {
    type: [{
      label: { type: String, default: 'Box 1' },
      multiplier: { type: Number, default: 0 },
      rollsRequired: { type: Number, default: 0 },
      isLoss: { type: Boolean, default: false }
    }],
    default: [
      { label: 'Box 1', multiplier: 3, rollsRequired: 5,  isLoss: false },
      { label: 'Box 2', multiplier: 5, rollsRequired: 20, isLoss: false },
      { label: 'Box 3', multiplier: 0, rollsRequired: 0,  isLoss: true  },
      { label: 'Box 4', multiplier: 2, rollsRequired: 8,  isLoss: false }
    ]
  }
});

const User = mongoose.model('User', userSchema);
const WinningCode = mongoose.model('WinningCode', winningCodeSchema);
const Entry = mongoose.model('Entry', entrySchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const Deposit = mongoose.model('Deposit', depositSchema);
const Admin = mongoose.model('Admin', adminSchema);
const AdminDevice = mongoose.model('AdminDevice', adminDeviceSchema);
const Achievement = mongoose.model('Achievement', achievementSchema);
const Referral = mongoose.model('Referral', referralSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const BonusSettings = mongoose.model('BonusSettings', bonusSettingsSchema);
const RandomRollRewards = mongoose.model('RandomRollRewards', randomRollRewardsSchema);
const PaymentSettings = mongoose.model('PaymentSettings', paymentSettingsSchema);
const GameSettings = mongoose.model('GameSettings', gameSettingsSchema);
const WheelSettings = mongoose.model('WheelSettings', wheelSettingsSchema);
const CoinSettings = mongoose.model('CoinSettings', coinSettingsSchema);
const CardSettings = mongoose.model('CardSettings', cardSettingsSchema);
const BoxSettings = mongoose.model('BoxSettings', boxSettingsSchema);

// ============ INITIALIZE DATA ============
async function initData() {
  const adminExists = await Admin.findOne();
  if (!adminExists) {
    const hashed = await bcrypt.hash('admin123', 10);
    await Admin.create({ username: 'admin', password: hashed, email: 'admin@lotto.com' });
    console.log('✅ Admin created: admin/admin123');
  }
  if ((await WinningCode.countDocuments()) === 0) {
    await WinningCode.create([
      { code: '123456', reward: 100, createdBy: 'admin' },
      { code: '777777', reward: 500, createdBy: 'admin' },
      { code: '000001', reward: 50, createdBy: 'admin' }
    ]);
    console.log('✅ Demo winning codes created');
  }
  if ((await BonusSettings.countDocuments()) === 0) await BonusSettings.create({});
  if ((await RandomRollRewards.countDocuments()) === 0) await RandomRollRewards.create({});
  if ((await PaymentSettings.countDocuments()) === 0) await PaymentSettings.create({});
  if ((await GameSettings.countDocuments()) === 0) await GameSettings.create({});
  if ((await WheelSettings.countDocuments()) === 0) await WheelSettings.create({});
  if ((await CoinSettings.countDocuments()) === 0) await CoinSettings.create({});
  if ((await CardSettings.countDocuments()) === 0) await CardSettings.create({});
  if ((await BoxSettings.countDocuments()) === 0) await BoxSettings.create({});
}
initData();

// ============ HELPERS ============
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function calculateMatches(winningCode, userCode) {
  let matches = 0;
  for (let i = 0; i < 6; i++) {
    if (winningCode[i] === userCode[i]) matches++;
  }
  return matches;
}

async function getRandomRollMultiplier(dice1, dice2) {
  const settings = await RandomRollRewards.findOne();
  if (!settings || !settings.enabled) return 0;
  const sum = dice1 + dice2;
  const r = settings.rewards;
  if (sum === 3) return r.sum3;
  if (sum === 4) return r.sum4;
  if (sum === 5) return r.sum5;
  if (sum === 6) return r.sum6;
  if (sum === 7) return r.sum7;
  if (sum === 8) return r.sum8;
  if (sum === 9) return r.sum9;
  if (sum === 10) return r.sum10;
  if (sum === 11) return r.sum11;
  if (Math.abs(dice1 - dice2) === 1) return r.consecutives;
  if ((dice1 % 2 === 0 && dice2 % 2 === 0) || (dice1 % 2 === 1 && dice2 % 2 === 1)) return r.sameParity;
  return 0;
}

function generateLeaderboardBots(count) {
  const prefixes = [
    'Lucky', 'Diamond', 'Golden', 'Silver', 'Mega', 'Super', 'Pro', 'Master',
    'Wild', 'Royal', 'Crown', 'Star', 'Thunder', 'Storm', 'Nova', 'Ace',
    'King', 'Queen', 'Jack', 'Turbo', 'Rapid', 'Swift', 'Bold', 'Brave',
    'Prime', 'Elite', 'Champ', 'Hero', 'Titan', 'Ninja', 'Shadow', 'Blaze',
    'Fire', 'Ice', 'Iron', 'Steel', 'Cosmic', 'Solar', 'Lunar', 'Neon',
    'Pixel', 'Cyber', 'Quantum', 'Alpha', 'Omega', 'Flash', 'Dash', 'Crystal'
  ];
  const suffixes = [
    'Winner', 'Player', 'Gamer', 'Hunter', 'Seeker', 'Slayer', 'King', 'Queen',
    'Ace', 'Pro', 'Star', 'Legend', 'Hero', 'Boss', 'Chief', 'Master',
    'Wolf', 'Tiger', 'Lion', 'Eagle', 'Hawk', 'Panther', 'Falcon', 'Viper',
    'Dragon', 'Phoenix', 'Shark', 'Cobra', 'Panda', 'Bear', 'Fox', 'Lynx',
    'Storm', 'Bolt', 'Flash', 'Blaze', 'Frost', 'Shadow', 'Ghost', 'Spirit'
  ];
  const numbers = ['', '7', '77', '88', '99', '123', '007', '24', '21', '69', '42', '55', '33', '11', '999', '777', '888', '101', '202', '303'];
  const separators = ['', '_', '-', '.'];

  const seen = new Set();
  const bots = [];
  let safety = 0;
  while (bots.length < count && safety < count * 10) {
    safety++;
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const s = suffixes[Math.floor(Math.random() * suffixes.length)];
    const n = numbers[Math.floor(Math.random() * numbers.length)];
    const sep = separators[Math.floor(Math.random() * separators.length)];
    let username = p + s + sep + n;
    if (seen.has(username)) continue;
    seen.add(username);

    const r = Math.random();
    const wins = Math.floor(50 + Math.pow(r, 1.8) * 4950);

    bots.push({ username, totalWins: wins });
  }
  return bots;
}

// ============ MIDDLEWARE ============
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token' });
  jwt.verify(token, 'secret', (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

// Admin: verify JWT + re-check the device is still approved (kicks revoked devices)
async function verifyAdmin(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token' });
  jwt.verify(token, 'secret', async (err, decoded) => {
    if (err || decoded.role !== 'admin') return res.status(401).json({ error: 'Admin only' });
    try {
      const device = await AdminDevice.findOne({ adminId: decoded.id, deviceId: decoded.deviceId });
      if (!device || device.status !== 'approved') {
        return res.status(401).json({ error: 'Device not authorized. Please log in again.' });
      }
      device.lastSeen = new Date();
      await device.save();
      req.admin = decoded;
      next();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

// ============ AUTH ============
app.post('/api/signup', async (req, res) => {
  try {
    const { name, username, email, password, legalName, dateOfBirth, homeAddress, referralCode } = req.body;
    if (await User.findOne({ $or: [{ username }, { email }] })) {
      return res.status(400).json({ error: 'Username or email exists' });
    }
    let age = null;
    if (dateOfBirth) {
      const today = new Date();
      const birth = new Date(dateOfBirth);
      age = today.getFullYear() - birth.getFullYear();
      if (age < 18) return res.status(400).json({ error: 'Must be 18+' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const newReferralCode = generateReferralCode();
    await User.create({
      name: name || legalName, username, email, password: hashed,
      legalName: legalName || name, dateOfBirth: dateOfBirth || null,
      homeAddress: homeAddress || '', age, referralCode: newReferralCode,
      referredBy: referralCode || null
    });
    res.json({ message: 'Account created. Awaiting admin approval.' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password, deviceId } = req.body;
    const ip = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 300);

    // ----- ADMIN LOGIN -----
    const admin = await Admin.findOne({ username });
    if (admin && await bcrypt.compare(password, admin.password)) {
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID missing. Please refresh and try again.' });
      }

      let device = await AdminDevice.findOne({ adminId: admin._id, deviceId });

      if (!device) {
        const approvedCount = await AdminDevice.countDocuments({ adminId: admin._id, status: 'approved' });
        const initialStatus = approvedCount < 2 ? 'approved' : 'pending';
        device = await AdminDevice.create({
          adminId: admin._id,
          deviceId,
          ip,
          userAgent,
          status: initialStatus,
          approvedAt: initialStatus === 'approved' ? new Date() : null
        });
      } else {
        device.ip = ip;
        device.userAgent = userAgent;
        device.lastSeen = new Date();
        await device.save();
      }

      if (device.status === 'revoked') {
        return res.status(403).json({ error: 'This device has been revoked. Please contact support.', code: 'REVOKED' });
      }
      if (device.status === 'pending') {
        return res.status(403).json({
          error: 'Awaiting admin approval. Your IP: ' + ip,
          code: 'PENDING',
          ip
        });
      }

      const token = jwt.sign(
        { id: admin._id, role: 'admin', username: admin.username, deviceId },
        'secret'
      );
      return res.json({ token, role: 'admin', username: admin.username });
    }

    // ----- USER LOGIN -----
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    if (user.status === 'pending') return res.status(400).json({ error: 'Pending approval' });
    const token = jwt.sign({ id: user._id, role: 'user', username: user.username }, 'secret');
    res.json({ token, role: 'user', user: { id: user._id, name: user.name, username: user.username, balance: user.balance, totalWins: user.totalWins } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/user', verifyToken, async (req, res) => {
  if (req.user.role === 'admin') return res.json({ role: 'admin' });
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

app.post('/api/claim-daily-reward', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const now = Date.now();
    const last = user.lastDailyClaim ? new Date(user.lastDailyClaim).getTime() : 0;
    if (now - last < 24 * 60 * 60 * 1000) {
      const msLeft = (24 * 60 * 60 * 1000) - (now - last);
      return res.status(400).json({ error: 'Already claimed. Come back later.', msLeft, nextClaimAt: last + (24 * 60 * 60 * 1000) });
    }
    user.balance += 5;
    user.lastDailyClaim = new Date();
    await user.save();
    res.json({ success: true, reward: 5, newBalance: user.balance, nextClaimAt: user.lastDailyClaim.getTime() + (24 * 60 * 60 * 1000) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/achievements', verifyToken, async (req, res) => {
  const a = await Achievement.findOne({ userId: req.user.id });
  res.json(a?.achievements || []);
});

app.get('/api/announcements', async (req, res) => {
  const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(10);
  res.json(announcements);
});

// ============ GAMES ============
app.post('/api/play-slot', verifyToken, async (req, res) => {
  const { stake } = req.body;
  const user = await User.findById(req.user.id);
  if (user.balance < stake) return res.status(400).json({ error: 'Insufficient balance' });

  const bonusSettings = await BonusSettings.findOne();
  const bonusMultipliers = bonusSettings.bonusMultipliers;

  user.balance -= stake;
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;

  let multiplier = 0;
  let win = false;

  if (dice1 === dice2) {
    const m = bonusMultipliers;
    if (dice1 === 1) multiplier = m.double1;
    else if (dice1 === 2) multiplier = m.double2;
    else if (dice1 === 3) multiplier = m.double3;
    else if (dice1 === 4) multiplier = m.double4;
    else if (dice1 === 5) multiplier = m.double5;
    else if (dice1 === 6) multiplier = m.double6;
    win = true;
  } else {
    const randomMultiplier = await getRandomRollMultiplier(dice1, dice2);
    if (randomMultiplier > 0) { multiplier = randomMultiplier; win = true; }
  }

  let winnings = 0;
  if (win) {
    winnings = stake * multiplier;
    user.balance += winnings;
    user.totalWins++;
  }
  await user.save();
  await Entry.create({ userId: user._id, username: user.username, game: 'Slot Dice', code: `${dice1}${dice2}`, rewardWon: winnings, stake });
  res.json({ win, dice1, dice2, reward: winnings, newBalance: user.balance });
});

app.post('/api/play', verifyToken, async (req, res) => {
  const { code, stake } = req.body;
  const user = await User.findById(req.user.id);
  if (user.balance < stake) return res.status(400).json({ error: 'Insufficient balance' });

  const existingWin = await Entry.findOne({ userId: user._id, code, rewardWon: { $gt: 0 } });
  user.balance -= stake;
  let reward = 0;
  let matches = 0;
  let alreadyWon = false;

  if (existingWin) {
    alreadyWon = true;
    matches = existingWin.matches || 0;
  } else {
    const winningCode = await WinningCode.findOne({ code });
    if (winningCode) {
      reward = winningCode.reward;
      user.balance += reward;
      user.totalWins++;
      matches = 6;
    } else {
      const allCodes = await WinningCode.find();
      for (const wc of allCodes) {
        const m = calculateMatches(wc.code, code);
        if (m > matches) matches = m;
      }
    }
  }
  await user.save();
  await Entry.create({ userId: user._id, username: user.username, game: 'Lotto', code, matches, rewardWon: reward, stake });
  res.json({ win: reward > 0, alreadyWon, matches, reward, newBalance: user.balance });
});

// ============ SPIN WHEEL ============
app.post('/api/play-spin-wheel', verifyToken, async (req, res) => {
  try {
    const { stake } = req.body;
    if (!stake || stake <= 0) return res.status(400).json({ error: 'Invalid stake' });

    const user = await User.findById(req.user.id);
    if (user.balance < stake) return res.status(400).json({ error: 'Insufficient balance' });

    const gameSettings = await GameSettings.findOne();
    if (!gameSettings || !gameSettings.spinWheel || !gameSettings.spinWheel.enabled) {
      return res.status(400).json({ error: 'Spin Wheel is disabled' });
    }

    const wheel = await WheelSettings.findOne();
    if (!wheel) return res.status(500).json({ error: 'Wheel settings missing' });

    const segments = wheel.segments;
    const currentSpin = user.wheelSpinCount + 1;
    const lastWon = user.wheelLastWon || {};

    const eligibleIndices = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.isLoss) continue;
      const lastWonAt = lastWon['seg_' + i] || 0;
      if (currentSpin - lastWonAt >= seg.rollsRequired) eligibleIndices.push(i);
    }

    const force = gameSettings.spinWheel.forceOutcome || 'auto';
    const lossIdx = segments.map((s, i) => s.isLoss ? i : -1).filter(i => i >= 0);

    let landedIndex;
    if (force === 'lose') {
      landedIndex = lossIdx[Math.floor(Math.random() * lossIdx.length)];
    } else if (force === 'win' && eligibleIndices.length > 0) {
      landedIndex = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
    } else if (eligibleIndices.length > 0) {
      if (Math.random() < 0.7) {
        landedIndex = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
      } else {
        landedIndex = lossIdx[Math.floor(Math.random() * lossIdx.length)];
      }
    } else {
      landedIndex = lossIdx[Math.floor(Math.random() * lossIdx.length)];
    }

    const landed = segments[landedIndex];
    const win = !landed.isLoss && landed.multiplier > 0;

    user.balance -= stake;
    let reward = 0;
    if (win) {
      reward = stake * landed.multiplier;
      user.balance += reward;
      user.totalWins += 1;
      user.wheelLastWon = { ...lastWon, ['seg_' + landedIndex]: currentSpin };
      user.markModified('wheelLastWon');
    }
    user.wheelSpinCount = currentSpin;
    await user.save();

    await Entry.create({
      userId: user._id, username: user.username, game: 'Spin Wheel',
      code: landed.label, rewardWon: reward, stake
    });

    res.json({
      win, landedIndex, landedLabel: landed.label, multiplier: landed.multiplier,
      reward, stake, newBalance: user.balance, totalSegments: segments.length
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ SEGMENTED GAMES (Coin / Card / Box) ============
async function playSegmentedGame(opts, req, res) {
  const { gameKey, configModel, itemsKey, spinCountField, lastWonField, gameLabel } = opts;
  try {
    const { stake } = req.body;
    if (!stake || stake <= 0) return res.status(400).json({ error: 'Invalid stake' });

    const user = await User.findById(req.user.id);
    if (user.balance < stake) return res.status(400).json({ error: 'Insufficient balance' });

    const gameSettings = await GameSettings.findOne();
    if (!gameSettings || !gameSettings[gameKey] || !gameSettings[gameKey].enabled) {
      return res.status(400).json({ error: gameLabel + ' is disabled' });
    }

    const cfgDoc = await configModel.findOne();
    if (!cfgDoc) return res.status(500).json({ error: gameLabel + ' settings missing' });

    const items = cfgDoc[itemsKey];
    const currentSpin = (user[spinCountField] || 0) + 1;
    const lastWon = user[lastWonField] || {};

    const eligible = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.isLoss) continue;
      const lastWonAt = lastWon['idx_' + i] || 0;
      if (currentSpin - lastWonAt >= item.rollsRequired) eligible.push(i);
    }

    const force = gameSettings[gameKey].forceOutcome || 'auto';
    const lossIdx = items.map((s, i) => s.isLoss ? i : -1).filter(i => i >= 0);

    let landedIndex;
    if (force === 'lose') {
      landedIndex = lossIdx[Math.floor(Math.random() * lossIdx.length)];
    } else if (force === 'win' && eligible.length > 0) {
      landedIndex = eligible[Math.floor(Math.random() * eligible.length)];
    } else if (eligible.length > 0) {
      if (Math.random() < 0.7) {
        landedIndex = eligible[Math.floor(Math.random() * eligible.length)];
      } else {
        landedIndex = lossIdx[Math.floor(Math.random() * lossIdx.length)];
      }
    } else {
      landedIndex = lossIdx[Math.floor(Math.random() * lossIdx.length)];
    }

    const landed = items[landedIndex];
    const win = !landed.isLoss && landed.multiplier > 0;

    user.balance -= stake;
    let reward = 0;
    if (win) {
      reward = stake * landed.multiplier;
      user.balance += reward;
      user.totalWins += 1;
      user[lastWonField] = { ...lastWon, ['idx_' + landedIndex]: currentSpin };
      user.markModified(lastWonField);
    }
    user[spinCountField] = currentSpin;
    await user.save();

    await Entry.create({
      userId: user._id, username: user.username, game: gameLabel,
      code: landed.label, rewardWon: reward, stake
    });

    const resp = {
      win, landedIndex, landedLabel: landed.label, multiplier: landed.multiplier,
      reward, stake, newBalance: user.balance, totalItems: items.length
    };
    if (landed.rank) resp.rank = landed.rank;
    if (landed.suit) resp.suit = landed.suit;

    res.json(resp);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

app.post('/api/play-coin-flip', verifyToken, (req, res) => playSegmentedGame({
  gameKey: 'coinFlip', configModel: CoinSettings, itemsKey: 'sides',
  spinCountField: 'coinSpinCount', lastWonField: 'coinLastWon', gameLabel: 'Coin Flip'
}, req, res));

app.post('/api/play-pick-card', verifyToken, (req, res) => playSegmentedGame({
  gameKey: 'pickCard', configModel: CardSettings, itemsKey: 'cards',
  spinCountField: 'cardSpinCount', lastWonField: 'cardLastWon', gameLabel: 'Pick a Card'
}, req, res));

app.post('/api/play-pick-box', verifyToken, (req, res) => playSegmentedGame({
  gameKey: 'pickBox', configModel: BoxSettings, itemsKey: 'boxes',
  spinCountField: 'boxSpinCount', lastWonField: 'boxLastWon', gameLabel: 'Pick a Box'
}, req, res));

// ============ PUBLIC GAME SETTINGS ============
app.get('/api/game-settings-public', async (req, res) => {
  try {
    let settings = await GameSettings.findOne();
    if (!settings) settings = await GameSettings.create({});
    let wheel = await WheelSettings.findOne();
    if (!wheel) wheel = await WheelSettings.create({});
    let coin = await CoinSettings.findOne();
    if (!coin) coin = await CoinSettings.create({});
    let card = await CardSettings.findOne();
    if (!card) card = await CardSettings.create({});
    let box = await BoxSettings.findOne();
    if (!box) box = await BoxSettings.create({});
    res.json({
      spinWheel: {
        enabled: settings.spinWheel.enabled,
        segments: wheel.segments.map(s => ({ label: s.label, isLoss: s.isLoss }))
      },
      coinFlip: {
        enabled: settings.coinFlip.enabled,
        sides: coin.sides.map(s => ({ label: s.label, isLoss: s.isLoss }))
      },
      pickCard: {
        enabled: settings.pickCard.enabled,
        cards: card.cards.map(s => ({ label: s.label, rank: s.rank, suit: s.suit, isLoss: s.isLoss }))
      },
      pickBox: {
        enabled: settings.pickBox.enabled,
        boxes: box.boxes.map(s => ({ label: s.label, isLoss: s.isLoss }))
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ HISTORY ============
app.get('/api/history', verifyToken, async (req, res) => {
  const entries = await Entry.find(req.user.role === 'admin' ? {} : { userId: req.user.id }).sort({ date: -1 });
  res.json(entries);
});

// ============ LEADERBOARD (1000 ranks) ============
app.get('/api/leaderboard', async (req, res) => {
  try {
    const TARGET = 1000;

    const realUsers = await User.find({ status: 'approved', username: { $ne: 'admin' } })
      .select('username totalWins')
      .lean();

    const realMapped = realUsers
      .map(u => ({ username: u.username, totalWins: u.totalWins || 0 }))
      .sort((a, b) => b.totalWins - a.totalWins);

    const remaining = TARGET - realMapped.length;
    const bots = remaining > 0 ? generateLeaderboardBots(remaining) : [];
    const botsSorted = bots.sort((a, b) => b.totalWins - a.totalWins);

    res.json([...realMapped, ...botsSorted]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/winning-codes', async (req, res) => {
  const codes = await WinningCode.find().select('code reward');
  res.json(codes);
});

app.get('/api/payment-settings-public', async (req, res) => {
  const settings = await PaymentSettings.findOne();
  res.json(settings);
});

// ============ DEPOSIT / WITHDRAW ============
app.post('/api/withdraw', verifyToken, async (req, res) => {
  const { amount, method, address, speed } = req.body;
  const user = await User.findById(req.user.id);
  let fee = 0;
  if (speed === 'express') fee = amount * 0.05;
  else if (speed === 'instant') fee = amount * 0.02;
  if (amount + fee > user.balance) return res.status(400).json({ error: 'Insufficient balance' });
  await Withdrawal.create({ userId: user._id, username: user.username, amount, method, address, speed, fee });
  res.json({ message: `Withdrawal submitted. Fee: $${fee}` });
});

app.post('/api/request-deposit', verifyToken, async (req, res) => {
  const { amount, method } = req.body;
  const user = await User.findById(req.user.id);
  if (amount < 10) return res.status(400).json({ error: 'Minimum $10' });
  await Deposit.create({ userId: user._id, username: user.username, amount, method });
  res.json({ message: 'Deposit request submitted' });
});

// ============ ADMIN ROUTES ============
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
});

app.get('/api/admin/pending-users', verifyAdmin, async (req, res) => {
  const users = await User.find({ status: 'pending' }).select('-password');
  res.json(users);
});

app.get('/api/admin/unverified-users', verifyAdmin, async (req, res) => {
  const users = await User.find({ verified: false, status: 'approved' }).select('-password');
  res.json(users);
});

app.post('/api/admin/approve-user', verifyAdmin, async (req, res) => {
  const user = await User.findById(req.body.userId);
  if (user) { user.status = 'approved'; if (user.balance === 0) user.balance = 75; await user.save(); res.json({ success: true }); }
  else res.status(404).json({ error: 'User not found' });
});

app.post('/api/admin/verify-user', verifyAdmin, async (req, res) => {
  const user = await User.findById(req.body.userId);
  if (user) { user.verified = true; await user.save(); res.json({ success: true }); }
  else res.status(404).json({ error: 'User not found' });
});

app.post('/api/admin/disable-user', verifyAdmin, async (req, res) => {
  const user = await User.findById(req.body.userId);
  if (user) { user.status = req.body.disabled ? 'disabled' : 'approved'; await user.save(); res.json({ success: true }); }
  else res.status(404).json({ error: 'User not found' });
});

app.post('/api/admin/boost-balance', verifyAdmin, async (req, res) => {
  const user = await User.findById(req.body.userId);
  if (user) { user.balance += req.body.amount; await user.save(); res.json({ success: true }); }
  else res.status(404).json({ error: 'User not found' });
});

// Reduce balance (clamped at 0)
app.post('/api/admin/reduce-balance', verifyAdmin, async (req, res) => {
  const user = await User.findById(req.body.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const amt = Number(req.body.amount) || 0;
  user.balance = Math.max(0, user.balance - amt);
  await user.save();
  res.json({ success: true, newBalance: user.balance });
});

app.post('/api/admin/force-logout', verifyAdmin, async (req, res) => {
  try { await User.findByIdAndUpdate(req.body.userId, { sessionToken: null }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ ADMIN: CHANGE PASSWORD ============
app.post('/api/admin/change-password', verifyAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    const ok = await bcrypt.compare(currentPassword, admin.password);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ ADMIN: DEVICES ============
app.get('/api/admin/devices', verifyAdmin, async (req, res) => {
  const devices = await AdminDevice.find({ adminId: req.admin.id }).sort({ firstSeen: -1 });
  res.json(devices);
});

app.get('/api/admin/pending-devices', verifyAdmin, async (req, res) => {
  const devices = await AdminDevice.find({ adminId: req.admin.id, status: 'pending' }).sort({ firstSeen: -1 });
  res.json(devices);
});

app.post('/api/admin/approve-device', verifyAdmin, async (req, res) => {
  try {
    const { deviceId, label } = req.body;
    const device = await AdminDevice.findOne({ adminId: req.admin.id, deviceId });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const approved = await AdminDevice.find({ adminId: req.admin.id, status: 'approved' }).sort({ approvedAt: 1 });
    if (approved.length >= 2) {
      const toRevoke = approved[0];
      toRevoke.status = 'revoked';
      await toRevoke.save();
    }

    device.status = 'approved';
    device.approvedAt = new Date();
    if (label) device.label = label;
    await device.save();

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/revoke-device', verifyAdmin, async (req, res) => {
  try {
    const { deviceId } = req.body;
    const device = await AdminDevice.findOne({ adminId: req.admin.id, deviceId });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    device.status = 'revoked';
    await device.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/delete-device', verifyAdmin, async (req, res) => {
  try {
    const { deviceId } = req.body;
    await AdminDevice.deleteOne({ adminId: req.admin.id, deviceId });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ ADMIN: WINNING CODES ============
app.get('/api/admin/winning-codes', verifyAdmin, async (req, res) => {
  try { const codes = await WinningCode.find().sort({ createdAt: -1 }); res.json(codes); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/set-winner', verifyAdmin, async (req, res) => {
  try {
    const { code, reward, expiryDays } = req.body;
    if (!code || code.length !== 6 || !reward) return res.status(400).json({ error: 'Invalid code or reward' });
    const expiry = expiryDays ? new Date(Date.now() + expiryDays * 86400000) : null;
    await WinningCode.create({ code, reward, expiry, createdBy: req.admin.username });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: 'Code already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete('/api/admin/winning-code/:id', verifyAdmin, async (req, res) => {
  try { await WinningCode.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ ADMIN: GAME SETTINGS ============
app.get('/api/admin/random-roll-rewards', verifyAdmin, async (req, res) => {
  try { let s = await RandomRollRewards.findOne(); if (!s) s = await RandomRollRewards.create({}); res.json(s); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/update-random-roll-rewards', verifyAdmin, async (req, res) => {
  try {
    let settings = await RandomRollRewards.findOne();
    if (!settings) settings = new RandomRollRewards();
    settings.rewards = req.body.rewards;
    settings.enabled = req.body.enabled !== undefined ? req.body.enabled : true;
    await settings.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/bonus-settings', verifyAdmin, async (req, res) => {
  try { let s = await BonusSettings.findOne(); if (!s) s = await BonusSettings.create({}); res.json(s); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/update-bonus-settings', verifyAdmin, async (req, res) => {
  try {
    let s = await BonusSettings.findOne();
    if (!s) s = new BonusSettings();
    s.rollsRequired = req.body.rollsRequired;
    s.bonusMultipliers = req.body.bonusMultipliers;
    await s.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/game-settings', verifyAdmin, async (req, res) => {
  try { let s = await GameSettings.findOne(); if (!s) s = await GameSettings.create({}); res.json(s); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/update-game-settings', verifyAdmin, async (req, res) => {
  try {
    let s = await GameSettings.findOne();
    if (!s) s = new GameSettings();
    const keys = ['spinWheel', 'coinFlip', 'pickCard', 'pickBox'];
    for (const k of keys) {
      if (req.body[k]) {
        s[k] = {
          enabled: req.body[k].enabled !== undefined ? req.body[k].enabled : (s[k]?.enabled ?? true),
          winProbability: req.body[k].winProbability !== undefined ? req.body[k].winProbability : (s[k]?.winProbability ?? 30),
          payoutMultiplier: req.body[k].payoutMultiplier !== undefined ? req.body[k].payoutMultiplier : (s[k]?.payoutMultiplier ?? 3),
          forceOutcome: req.body[k].forceOutcome || s[k]?.forceOutcome || 'auto'
        };
      }
    }
    await s.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/wheel-settings', verifyAdmin, async (req, res) => {
  try { let w = await WheelSettings.findOne(); if (!w) w = await WheelSettings.create({}); res.json(w); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/update-wheel-settings', verifyAdmin, async (req, res) => {
  try {
    let w = await WheelSettings.findOne();
    if (!w) w = new WheelSettings();
    if (Array.isArray(req.body.segments) && req.body.segments.length === 10) {
      w.segments = req.body.segments.map((s, i) => ({
        label: String(s.label || `$${i}`),
        multiplier: Number(s.multiplier) || 0,
        rollsRequired: Number(s.rollsRequired) || 0,
        isLoss: Boolean(s.isLoss)
      }));
    }
    await w.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/coin-settings', verifyAdmin, async (req, res) => {
  try { let c = await CoinSettings.findOne(); if (!c) c = await CoinSettings.create({}); res.json(c); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/update-coin-settings', verifyAdmin, async (req, res) => {
  try {
    let c = await CoinSettings.findOne();
    if (!c) c = new CoinSettings();
    if (Array.isArray(req.body.sides)) {
      c.sides = req.body.sides.map((s, i) => ({
        label: String(s.label || `Side ${i+1}`),
        multiplier: Number(s.multiplier) || 0,
        rollsRequired: Number(s.rollsRequired) || 0,
        isLoss: Boolean(s.isLoss)
      }));
    }
    await c.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/card-settings', verifyAdmin, async (req, res) => {
  try { let c = await CardSettings.findOne(); if (!c) c = await CardSettings.create({}); res.json(c); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/update-card-settings', verifyAdmin, async (req, res) => {
  try {
    let c = await CardSettings.findOne();
    if (!c) c = new CardSettings();
    if (Array.isArray(req.body.cards)) {
      c.cards = req.body.cards.map((s, i) => ({
        label: String(s.label || `Card ${i+1}`),
        rank: String(s.rank || 'A'),
        suit: String(s.suit || '♠'),
        multiplier: Number(s.multiplier) || 0,
        rollsRequired: Number(s.rollsRequired) || 0,
        isLoss: Boolean(s.isLoss)
      }));
    }
    await c.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/box-settings', verifyAdmin, async (req, res) => {
  try { let c = await BoxSettings.findOne(); if (!c) c = await BoxSettings.create({}); res.json(c); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/update-box-settings', verifyAdmin, async (req, res) => {
  try {
    let c = await BoxSettings.findOne();
    if (!c) c = new BoxSettings();
    if (Array.isArray(req.body.boxes)) {
      c.boxes = req.body.boxes.map((s, i) => ({
        label: String(s.label || `Box ${i+1}`),
        multiplier: Number(s.multiplier) || 0,
        rollsRequired: Number(s.rollsRequired) || 0,
        isLoss: Boolean(s.isLoss)
      }));
    }
    await c.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ADMIN: PAYMENT
app.get('/api/admin/payment-settings', verifyAdmin, async (req, res) => {
  try { let s = await PaymentSettings.findOne(); if (!s) s = await PaymentSettings.create({}); res.json(s); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/update-payment-settings', verifyAdmin, async (req, res) => {
  try {
    let s = await PaymentSettings.findOne();
    if (!s) s = new PaymentSettings();
    if (req.body.cryptoWallets) s.cryptoWallets = req.body.cryptoWallets;
    if (req.body.bankDetails) s.bankDetails = req.body.bankDetails;
    if (req.body.withdrawalFees) s.withdrawalFees = req.body.withdrawalFees;
    await s.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: DEPOSITS
app.get('/api/admin/pending-deposits', verifyAdmin, async (req, res) => {
  const deposits = await Deposit.find({ status: 'pending' }).sort({ requestedAt: -1 });
  res.json(deposits);
});

app.get('/api/admin/all-deposits', verifyAdmin, async (req, res) => {
  const deposits = await Deposit.find().sort({ requestedAt: -1 });
  res.json(deposits);
});

app.post('/api/admin/approve-deposit', verifyAdmin, async (req, res) => {
  const { depositId, transactionId } = req.body;
  const deposit = await Deposit.findById(depositId);
  if (deposit) {
    deposit.status = 'approved';
    if (transactionId) deposit.transactionId = transactionId;
    await deposit.save();
    const user = await User.findById(deposit.userId);
    if (user) { user.balance += deposit.amount; await user.save(); }
    res.json({ success: true });
  } else res.status(404).json({ error: 'Not found' });
});

app.post('/api/admin/reject-deposit', verifyAdmin, async (req, res) => {
  const deposit = await Deposit.findById(req.body.depositId);
  if (deposit) { deposit.status = 'rejected'; await deposit.save(); res.json({ success: true }); }
  else res.status(404).json({ error: 'Not found' });
});

// ADMIN: WITHDRAWALS
app.get('/api/admin/withdrawals', verifyAdmin, async (req, res) => {
  const withdrawals = await Withdrawal.find().sort({ requestedAt: -1 });
  res.json(withdrawals);
});

app.post('/api/admin/approve-withdrawal', verifyAdmin, async (req, res) => {
  const { withdrawalId } = req.body;
  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (withdrawal) {
    withdrawal.status = 'approved';
    await withdrawal.save();
    const user = await User.findById(withdrawal.userId);
    if (user) user.balance -= (withdrawal.amount + withdrawal.fee);
    await user.save();
    res.json({ success: true });
  } else res.status(404).json({ error: 'Not found' });
});

app.post('/api/admin/reject-withdrawal', verifyAdmin, async (req, res) => {
  const withdrawal = await Withdrawal.findById(req.body.withdrawalId);
  if (withdrawal) { withdrawal.status = 'rejected'; await withdrawal.save(); res.json({ success: true }); }
  else res.status(404).json({ error: 'Not found' });
});

// ADMIN: ANNOUNCEMENTS / ANALYTICS
app.post('/api/admin/send-announcement', verifyAdmin, async (req, res) => {
  await Announcement.create({ title: req.body.title, message: req.body.message, createdBy: req.admin.username });
  res.json({ success: true });
});

app.get('/api/admin/announcements', verifyAdmin, async (req, res) => {
  const announcements = await Announcement.find().sort({ createdAt: -1 });
  res.json(announcements);
});

app.get('/api/admin/entries', verifyAdmin, async (req, res) => {
  try { const entries = await Entry.find().sort({ date: -1 }).limit(200); res.json(entries); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/analytics', verifyAdmin, async (req, res) => {
  const totalUsers = await User.countDocuments();
  const deposits = await Deposit.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  const withdrawals = await Withdrawal.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  res.json({
    totalUsers,
    totalDeposits: deposits[0]?.total || 0,
    totalWithdrawals: withdrawals[0]?.total || 0,
    netRevenue: (deposits[0]?.total || 0) - (withdrawals[0]?.total || 0)
  });
});

app.post('/api/admin/manual-award', verifyAdmin, async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const user = await User.findById(userId);
    if (user) { user.balance += amount; user.totalWins++; await user.save(); res.json({ success: true }); }
    else res.status(404).json({ error: 'User not found' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/send-verification-email', verifyAdmin, async (req, res) => {
  try {
    const { userId, message } = req.body;
    const user = await User.findById(userId);
    if (user) { console.log(`📧 Verification email to ${user.email}: ${message}`); res.json({ success: true, message: 'Email sent (demo mode)' }); }
    else res.status(404).json({ error: 'User not found' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ SERVE HTML ============
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'login.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running: http://localhost:${PORT}`);
  console.log(`🔐 Admin login: http://localhost:${PORT}/admin (admin/admin123)`);
  console.log(`👤 User login: http://localhost:${PORT}`);
  console.log(`✅ All features working!`);
});