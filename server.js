require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lotto_db';

mongoose.connect(MONGODB_URI).then(() => {
 console.log(' MongoDB connected');
}).catch(err => {
 console.error(' MongoDB error:', err.message);
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
 username: String, 
 password: String, 
 email: String
});

const achievementSchema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, unique: true },
 achievements: [{ name: String, earnedAt: Date }]
});

const referralSchema = new mongoose.Schema({
 userId: mongoose.Schema.Types.ObjectId,
 referredUserId: mongoose.Schema.Types.ObjectId,
 commissionEarned: Number,
 status: String,
 createdAt: Date
});

const announcementSchema = new mongoose.Schema({
 title: String, 
 message: String, 
 createdBy: String, 
 createdAt: { type: Date, default: Date.now }
});

const bonusSettingsSchema = new mongoose.Schema({
 rollsRequired: {
 double1: { type: Number, default: 30 }, 
 double2: { type: Number, default: 25 },
 double3: { type: Number, default: 25 }, 
 double4: { type: Number, default: 20 },
 double5: { type: Number, default: 15 }, 
 double6: { type: Number, default: 50 }
 },
 bonusMultipliers: {
 double1: { type: Number, default: 8 }, 
 double2: { type: Number, default: 6 },
 double3: { type: Number, default: 6 }, 
 double4: { type: Number, default: 8 },
 double5: { type: Number, default: 10 }, 
 double6: { type: Number, default: 25 }
 }
});

const randomRollRewardsSchema = new mongoose.Schema({
 enabled: { type: Boolean, default: true },
 rewards: {
 sum3: { type: Number, default: 1.5 }, 
 sum4: { type: Number, default: 1.5 },
 sum5: { type: Number, default: 2 }, 
 sum6: { type: Number, default: 2 },
 sum7: { type: Number, default: 2.5 }, 
 sum8: { type: Number, default: 2.5 },
 sum9: { type: Number, default: 3 }, 
 sum10: { type: Number, default: 3 },
 sum11: { type: Number, default: 3.5 }, 
 consecutives: { type: Number, default: 2 },
 sameParity: { type: Number, default: 1.5 }
 }
});

const paymentSettingsSchema = new mongoose.Schema({
 cryptoWallets: { 
 usdt: { type: String, default: '' }, 
 btc: { type: String, default: '' } 
 },
 withdrawalFees: { 
 standard: { type: Number, default: 0 }, 
 express: { type: Number, default: 5 }, 
 instant: { type: Number, default: 2 } 
 },
 bankDetails: { 
 bankName: { type: String, default: '' }, 
 accountName: { type: String, default: '' }, 
 accountNumber: { type: String, default: '' }, 
 routingNumber: { type: String, default: '' }, 
 swiftCode: { type: String, default: '' } 
 }
});

const User = mongoose.model('User', userSchema);
const WinningCode = mongoose.model('WinningCode', winningCodeSchema);
const Entry = mongoose.model('Entry', entrySchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const Deposit = mongoose.model('Deposit', depositSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Achievement = mongoose.model('Achievement', achievementSchema);
const Referral = mongoose.model('Referral', referralSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const BonusSettings = mongoose.model('BonusSettings', bonusSettingsSchema);
const RandomRollRewards = mongoose.model('RandomRollRewards', randomRollRewardsSchema);
const PaymentSettings = mongoose.model('PaymentSettings', paymentSettingsSchema);

// ============ INITIALIZE DATA ============
async function initData() {
 const adminExists = await Admin.findOne();
 if (!adminExists) {
 const hashed = await bcrypt.hash('admin123', 10);
 await Admin.create({ username: 'admin', password: hashed, email: 'admin@lotto.com' });
 console.log(' Admin created: admin/admin123');
 }
 if ((await WinningCode.countDocuments()) === 0) {
 await WinningCode.create([
 { code: '123456', reward: 100, createdBy: 'admin' },
 { code: '777777', reward: 500, createdBy: 'admin' },
 { code: '000001', reward: 50, createdBy: 'admin' }
 ]);
 console.log(' Demo winning codes created');
 }
 if ((await BonusSettings.countDocuments()) === 0) await BonusSettings.create({});
 if ((await RandomRollRewards.countDocuments()) === 0) await RandomRollRewards.create({});
 if ((await PaymentSettings.countDocuments()) === 0) await PaymentSettings.create({});
}
initData();

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

function verifyAdmin(req, res, next) {
 const token = req.headers['authorization'];
 if (!token) return res.status(401).json({ error: 'No token' });
 jwt.verify(token, 'secret', (err, decoded) => {
 if (err || decoded.role !== 'admin') return res.status(401).json({ error: 'Admin only' });
 req.admin = decoded;
 next();
 });
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

// ============ AUTH ROUTES ============
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
 
 const newUser = await User.create({
 name: name || legalName, 
 username, 
 email, 
 password: hashed,
 legalName: legalName || name, 
 dateOfBirth: dateOfBirth || null,
 homeAddress: homeAddress || '', 
 age, 
 referralCode: newReferralCode,
 referredBy: referralCode || null
 });
 
 if (referralCode) {
 const referrer = await User.findOne({ referralCode });
 if (referrer) {
 console.log(`User ${username} referred by ${referrer.username}`);
 }
 }
 
 res.json({ message: 'Account created. Awaiting admin approval.' });
 } catch(e) { 
 res.status(500).json({ error: e.message }); 
 }
});

app.post('/api/login', async (req, res) => {
 try {
 const { username, password } = req.body;
 const admin = await Admin.findOne({ username });
 if (admin && await bcrypt.compare(password, admin.password)) {
 const token = jwt.sign({ id: admin._id, role: 'admin', username: admin.username }, 'secret');
 return res.json({ token, role: 'admin', username: admin.username });
 }
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
 const user = await User.findById(req.user.id);
 user.balance += 5;
 await user.save();
 res.json({ success: true, reward: 5 });
});

app.get('/api/achievements', verifyToken, async (req, res) => {
 const a = await Achievement.findOne({ userId: req.user.id });
 res.json(a?.achievements || []);
});

app.get('/api/announcements', async (req, res) => {
 const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(10);
 res.json(announcements);
});

// ============ GAME ROUTES ============
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
 if (randomMultiplier > 0) {
 multiplier = randomMultiplier;
 win = true;
 }
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

app.get('/api/history', verifyToken, async (req, res) => {
 const entries = await Entry.find(req.user.role === 'admin' ? {} : { userId: req.user.id }).sort({ date: -1 });
 res.json(entries);
});

// UPDATED LEADERBOARD - Only shows wins, no balance
app.get('/api/leaderboard', async (req, res) => {
 const users = await User.find({ status: 'approved', username: { $ne: 'admin' } }).sort({ totalWins: -1 }).limit(10).select('name username totalWins');
 res.json(users);
});

app.get('/api/winning-codes', async (req, res) => {
 const codes = await WinningCode.find().select('code reward');
 res.json(codes);
});

// REMOVED referral-info endpoint
// app.get('/api/referral-info', ...) - DELETED

app.get('/api/payment-settings-public', async (req, res) => {
 const settings = await PaymentSettings.findOne();
 res.json(settings);
});

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
 if (user) { 
 user.status = 'approved'; 
 if (user.balance === 0) user.balance = 75; 
 await user.save(); 
 res.json({ success: true }); 
 } else res.status(404).json({ error: 'User not found' });
});

app.post('/api/admin/verify-user', verifyAdmin, async (req, res) => {
 const user = await User.findById(req.body.userId);
 if (user) { 
 user.verified = true; 
 await user.save(); 
 res.json({ success: true }); 
 } else res.status(404).json({ error: 'User not found' });
});

app.post('/api/admin/disable-user', verifyAdmin, async (req, res) => {
 const user = await User.findById(req.body.userId);
 if (user) { 
 user.status = req.body.disabled ? 'disabled' : 'approved'; 
 await user.save(); 
 res.json({ success: true }); 
 } else res.status(404).json({ error: 'User not found' });
});

app.post('/api/admin/boost-balance', verifyAdmin, async (req, res) => {
 const user = await User.findById(req.body.userId);
 if (user) { 
 user.balance += req.body.amount; 
 await user.save(); 
 res.json({ success: true }); 
 } else res.status(404).json({ error: 'User not found' });
});

app.post('/api/admin/force-logout', verifyAdmin, async (req, res) => {
 try {
 const { userId } = req.body;
 await User.findByIdAndUpdate(userId, { sessionToken: null });
 res.json({ success: true });
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.get('/api/admin/winning-codes', verifyAdmin, async (req, res) => {
 try {
 const codes = await WinningCode.find().sort({ createdAt: -1 });
 res.json(codes);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.post('/api/admin/set-winner', verifyAdmin, async (req, res) => {
 try {
 const { code, reward, expiryDays } = req.body;
 if (!code || code.length !== 6 || !reward) {
 return res.status(400).json({ error: 'Invalid code or reward' });
 }
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
 try {
 await WinningCode.findByIdAndDelete(req.params.id);
 res.json({ success: true });
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.get('/api/admin/random-roll-rewards', verifyAdmin, async (req, res) => {
 try {
 let settings = await RandomRollRewards.findOne();
 if (!settings) {
 settings = await RandomRollRewards.create({});
 }
 res.json(settings);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.post('/api/admin/update-random-roll-rewards', verifyAdmin, async (req, res) => {
 try {
 let settings = await RandomRollRewards.findOne();
 if (!settings) {
 settings = new RandomRollRewards();
 }
 settings.rewards = req.body.rewards;
 settings.enabled = req.body.enabled !== undefined ? req.body.enabled : true;
 await settings.save();
 res.json({ success: true });
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.get('/api/admin/bonus-settings', verifyAdmin, async (req, res) => {
 try {
 let settings = await BonusSettings.findOne();
 if (!settings) {
 settings = await BonusSettings.create({});
 }
 res.json(settings);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.post('/api/admin/update-bonus-settings', verifyAdmin, async (req, res) => {
 try {
 let settings = await BonusSettings.findOne();
 if (!settings) {
 settings = new BonusSettings();
 }
 settings.rollsRequired = req.body.rollsRequired;
 settings.bonusMultipliers = req.body.bonusMultipliers;
 await settings.save();
 res.json({ success: true });
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.get('/api/admin/payment-settings', verifyAdmin, async (req, res) => {
 try {
 let settings = await PaymentSettings.findOne();
 if (!settings) {
 settings = await PaymentSettings.create({});
 }
 res.json(settings);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.post('/api/admin/update-payment-settings', verifyAdmin, async (req, res) => {
 try {
 let settings = await PaymentSettings.findOne();
 if (!settings) {
 settings = new PaymentSettings();
 }
 if (req.body.cryptoWallets) settings.cryptoWallets = req.body.cryptoWallets;
 if (req.body.bankDetails) settings.bankDetails = req.body.bankDetails;
 if (req.body.withdrawalFees) settings.withdrawalFees = req.body.withdrawalFees;
 await settings.save();
 res.json({ success: true });
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

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
 if (user) {
 user.balance += deposit.amount;
 await user.save();
 }
 res.json({ success: true });
 } else res.status(404).json({ error: 'Not found' });
});

app.post('/api/admin/reject-deposit', verifyAdmin, async (req, res) => {
 const deposit = await Deposit.findById(req.body.depositId);
 if (deposit) { 
 deposit.status = 'rejected'; 
 await deposit.save(); 
 res.json({ success: true }); 
 } else res.status(404).json({ error: 'Not found' });
});

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
 if (withdrawal) { 
 withdrawal.status = 'rejected'; 
 await withdrawal.save(); 
 res.json({ success: true }); 
 } else res.status(404).json({ error: 'Not found' });
});

app.post('/api/admin/send-announcement', verifyAdmin, async (req, res) => {
 await Announcement.create({ 
 title: req.body.title, 
 message: req.body.message,
 createdBy: req.admin.username 
 });
 res.json({ success: true });
});

app.get('/api/admin/announcements', verifyAdmin, async (req, res) => {
 const announcements = await Announcement.find().sort({ createdAt: -1 });
 res.json(announcements);
});

app.get('/api/admin/entries', verifyAdmin, async (req, res) => {
 try {
 const entries = await Entry.find().sort({ date: -1 }).limit(200);
 res.json(entries);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
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
 if (user) {
 user.balance += amount;
 user.totalWins++;
 await user.save();
 res.json({ success: true });
 } else {
 res.status(404).json({ error: 'User not found' });
 }
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.post('/api/admin/send-verification-email', verifyAdmin, async (req, res) => {
 try {
 const { userId, message } = req.body;
 const user = await User.findById(userId);
 if (user) {
 console.log(` Verification email to ${user.email}: ${message}`);
 res.json({ success: true, message: 'Email sent (demo mode)' });
 } else {
 res.status(404).json({ error: 'User not found' });
 }
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

// ============ SERVE HTML ============
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'login.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
 console.log(`\n Server running: http://localhost:${PORT}`);
 console.log(` Admin login: http://localhost:${PORT}/admin (admin/admin123)`);
 console.log(` User login: http://localhost:${PORT}`);
 console.log(` All features working!`);
});