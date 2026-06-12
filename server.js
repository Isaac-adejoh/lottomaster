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

mongoose.connect(MONGODB_URI, {
 useNewUrlParser: true,
 useUnifiedTopology: true
}).then(() => {
 console.log(' MongoDB connected successfully');
}).catch(err => {
 console.error(' MongoDB connection error:', err.message);
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
 ip: String,
 device: String,
 legalName: String,
 dateOfBirth: Date,
 homeAddress: String,
 age: Number,
 vipTier: { type: String, default: 'Bronze' },
 referralCode: { type: String, unique: true, sparse: true },
 referredBy: mongoose.Schema.Types.ObjectId,
 commissionBalance: { type: Number, default: 0 },
 totalCommissionEarned: { type: Number, default: 0 },
 sessionToken: String,
 lastActive: { type: Date, default: Date.now },
 bankDetails: {
 bankName: String,
 accountName: String,
 accountNumber: String
 },
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
 game: { type: String, default: 'Lotto' },
 code: String,
 matches: Number,
 rewardWon: { type: Number, default: 0 },
 stake: { type: Number, default: 0 },
 date: { type: Date, default: Date.now }
});

const withdrawalSchema = new mongoose.Schema({
 userId: mongoose.Schema.Types.ObjectId,
 username: String,
 amount: Number,
 method: String,
 address: String,
 speed: { type: String, default: 'standard' },
 fee: { type: Number, default: 0 },
 status: { type: String, default: 'pending' },
 requestedAt: { type: Date, default: Date.now },
 approvedAt: Date
});

const depositSchema = new mongoose.Schema({
 userId: mongoose.Schema.Types.ObjectId,
 username: String,
 amount: Number,
 method: { type: String, enum: ['crypto_usdt', 'crypto_btc', 'bank_transfer'] },
 status: { type: String, default: 'pending' },
 transactionId: String,
 requestedAt: { type: Date, default: Date.now },
 approvedAt: Date
});

const adminSchema = new mongoose.Schema({
 username: { type: String, required: true, unique: true },
 password: { type: String, required: true },
 email: String
});

const achievementSchema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
 achievements: [{
 name: String,
 earnedAt: { type: Date, default: Date.now }
 }]
});

const referralSchema = new mongoose.Schema({
 userId: mongoose.Schema.Types.ObjectId,
 referredUserId: mongoose.Schema.Types.ObjectId,
 commissionEarned: { type: Number, default: 0 },
 status: { type: String, default: 'pending' },
 createdAt: { type: Date, default: Date.now }
});

const announcementSchema = new mongoose.Schema({
 userId: mongoose.Schema.Types.ObjectId,
 username: String,
 title: String,
 message: String,
 type: { type: String, default: 'info' },
 createdBy: String,
 createdAt: { type: Date, default: Date.now },
 expiresAt: Date
});

const paymentSettingsSchema = new mongoose.Schema({
 cryptoWallets: {
 usdt: { type: String, default: 'TX7hH3kL9mN4pQ2rS5tU6vW7xY8zA9bC0dE1fG' },
 btc: { type: String, default: '1A2b3C4d5E6f7G8h9I0jK1lL2mM3nN4oO5pP' }
 },
 withdrawalFees: {
 standard: { type: Number, default: 0 },
 express: { type: Number, default: 5 },
 instant: { type: Number, default: 2 }
 },
 bankDetails: {
 bankName: { type: String, default: 'Global Bank' },
 accountName: { type: String, default: 'LottoMaster Gaming' },
 accountNumber: { type: String, default: '1234567890' },
 routingNumber: { type: String, default: '987654321' },
 swiftCode: { type: String, default: 'GLBANK22' }
 },
 updatedAt: { type: Date, default: Date.now }
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
 },
 updatedAt: { type: Date, default: Date.now }
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
 },
 updatedAt: { type: Date, default: Date.now }
});

const bonusTrackerSchema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
 rollsSinceLastBonus: { type: Number, default: 0 },
 bonusCounts: {
 double1: { type: Number, default: 0 },
 double2: { type: Number, default: 0 },
 double3: { type: Number, default: 0 },
 double4: { type: Number, default: 0 },
 double5: { type: Number, default: 0 },
 double6: { type: Number, default: 0 }
 },
 lastUpdated: { type: Date, default: Date.now }
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
const PaymentSettings = mongoose.model('PaymentSettings', paymentSettingsSchema);
const BonusSettings = mongoose.model('BonusSettings', bonusSettingsSchema);
const RandomRollRewards = mongoose.model('RandomRollRewards', randomRollRewardsSchema);
const BonusTracker = mongoose.model('BonusTracker', bonusTrackerSchema);

// ============ HELPER FUNCTIONS ============

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

function getRewardPercentage(matches) {
 if (matches === 6) return 1.0;
 if (matches === 5) return 0.5;
 if (matches === 4) return 0.2;
 if (matches === 3) return 0.05;
 return 0;
}

async function initAdmin() {
 const existing = await Admin.findOne();
 if (!existing) {
 const hashed = await bcrypt.hash('admin123', 10);
 await new Admin({
 username: 'admin',
 password: hashed,
 email: 'admin@lotto.com'
 }).save();
 console.log(' Default admin created (username: admin, password: admin123)');
 }
}

async function initWinningCodes() {
 const count = await WinningCode.countDocuments();
 if (count === 0) {
 await WinningCode.insertMany([
 { code: '123456', reward: 100, expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), createdBy: 'admin' },
 { code: '777777', reward: 500, expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), createdBy: 'admin' },
 { code: '000001', reward: 50, expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), createdBy: 'admin' }
 ]);
 console.log(' Demo winning codes created');
 }
}

async function initPaymentSettings() {
 const settings = await PaymentSettings.findOne();
 if (!settings) {
 await new PaymentSettings({}).save();
 console.log(' Payment settings initialized');
 }
}

async function initBonusSettings() {
 const settings = await BonusSettings.findOne();
 if (!settings) {
 await new BonusSettings({}).save();
 console.log(' Bonus settings initialized');
 }
}

async function initRandomRollRewards() {
 const settings = await RandomRollRewards.findOne();
 if (!settings) {
 await new RandomRollRewards({}).save();
 console.log(' Random roll rewards initialized');
 }
}

// ============ AUTH MIDDLEWARE ============

function verifyToken(req, res, next) {
 const token = req.headers['authorization'];
 if (!token) {
 return res.status(401).json({ error: 'No token provided' });
 }
 
 jwt.verify(token, process.env.JWT_SECRET || 'my_secret_key', (err, decoded) => {
 if (err) {
 return res.status(401).json({ error: 'Invalid token' });
 }
 req.user = decoded;
 next();
 });
}

function verifyAdmin(req, res, next) {
 const token = req.headers['authorization'];
 if (!token) {
 return res.status(401).json({ error: 'No token provided' });
 }
 
 jwt.verify(token, process.env.JWT_SECRET || 'my_secret_key', (err, decoded) => {
 if (err || decoded.role !== 'admin') {
 return res.status(401).json({ error: 'Admin access required' });
 }
 req.admin = decoded;
 next();
 });
}

// ============ RANDOM ROLL REWARDS HELPER ============
async function getRandomRollMultiplier(dice1, dice2) {
 const settings = await RandomRollRewards.findOne();
 if (!settings || !settings.enabled) return 0;
 
 const sum = dice1 + dice2;
 const rewards = settings.rewards;
 
 if (sum === 3) return rewards.sum3;
 if (sum === 4) return rewards.sum4;
 if (sum === 5) return rewards.sum5;
 if (sum === 6) return rewards.sum6;
 if (sum === 7) return rewards.sum7;
 if (sum === 8) return rewards.sum8;
 if (sum === 9) return rewards.sum9;
 if (sum === 10) return rewards.sum10;
 if (sum === 11) return rewards.sum11;
 if (Math.abs(dice1 - dice2) === 1) return rewards.consecutives;
 if ((dice1 % 2 === 0 && dice2 % 2 === 0) || (dice1 % 2 === 1 && dice2 % 2 === 1)) return rewards.sameParity;
 
 return 0;
}

// ============ PUBLIC ROUTES ============

// Signup
app.post('/api/signup', async (req, res) => {
 try {
 const { name, username, email, password, legalName, dateOfBirth, homeAddress, bankDetails, referralCode } = req.body;
 
 const existingUser = await User.findOne({ $or: [{ username }, { email }] });
 if (existingUser) {
 return res.status(400).json({ error: 'Username or email already exists' });
 }
 
 const hashedPassword = await bcrypt.hash(password, 10);
 const newReferralCode = generateReferralCode();
 
 let referredByUser = null;
 if (referralCode) {
 referredByUser = await User.findOne({ referralCode });
 }
 
 const user = new User({
 name: name || legalName,
 username,
 email,
 password: hashedPassword,
 legalName: legalName || name,
 dateOfBirth: dateOfBirth || null,
 homeAddress: homeAddress || '',
 referralCode: newReferralCode,
 referredBy: referredByUser ? referredByUser._id : null,
 ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
 device: req.headers['user-agent'],
 bankDetails: bankDetails || {}
 });
 
 await user.save();
 
 if (referredByUser) {
 const referral = new Referral({
 userId: referredByUser._id,
 referredUserId: user._id,
 status: 'pending'
 });
 await referral.save();
 }
 
 console.log(' User created:', username);
 res.json({ message: 'Account created. Admin will review your information.' });
 } catch (error) {
 console.error('Signup error:', error);
 res.status(500).json({ error: error.message });
 }
});

// Login
app.post('/api/login', async (req, res) => {
 try {
 const { username, password } = req.body;
 
 const admin = await Admin.findOne({ username });
 if (admin) {
 const valid = await bcrypt.compare(password, admin.password);
 if (valid) {
 const token = jwt.sign({ id: admin._id, role: 'admin', username: admin.username }, process.env.JWT_SECRET || 'my_secret_key');
 return res.json({ token, role: 'admin', username: admin.username });
 }
 }
 
 const user = await User.findOne({ username });
 if (!user) {
 return res.status(400).json({ error: 'Invalid credentials' });
 }
 
 const valid = await bcrypt.compare(password, user.password);
 if (!valid) {
 return res.status(400).json({ error: 'Invalid credentials' });
 }
 
 if (user.status === 'pending') {
 return res.status(400).json({ error: 'Account pending admin approval' });
 }
 if (user.status === 'disabled') {
 return res.status(400).json({ error: 'Account disabled by admin' });
 }
 
 user.lastActive = new Date();
 await user.save();
 
 const token = jwt.sign({ id: user._id, role: 'user', username: user.username }, process.env.JWT_SECRET || 'my_secret_key');
 res.json({
 token,
 role: 'user',
 user: {
 id: user._id,
 name: user.name,
 username: user.username,
 balance: user.balance,
 totalWins: user.totalWins,
 verified: user.verified,
 vipTier: user.vipTier,
 referralCode: user.referralCode
 }
 });
 } catch (error) {
 console.error('Login error:', error);
 res.status(500).json({ error: error.message });
 }
});

// Get current user
app.get('/api/user', verifyToken, async (req, res) => {
 try {
 if (req.user.role === 'admin') {
 return res.json({ role: 'admin' });
 }
 const user = await User.findById(req.user.id).select('-password');
 if (!user) {
 return res.status(404).json({ error: 'User not found' });
 }
 res.json(user);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Daily Login Reward
app.post('/api/claim-daily-reward', verifyToken, async (req, res) => {
 try {
 const user = await User.findById(req.user.id);
 user.balance += 5;
 await user.save();
 res.json({ success: true, reward: 5, message: 'Daily reward claimed! +$5' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Get achievements
app.get('/api/achievements', verifyToken, async (req, res) => {
 try {
 let achievements = await Achievement.findOne({ userId: req.user.id });
 if (!achievements) {
 achievements = { achievements: [] };
 }
 res.json(achievements.achievements);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Apply bonus code
app.post('/api/apply-bonus-code', verifyToken, async (req, res) => {
 try {
 const { code } = req.body;
 if (code && code.length >= 6) {
 const user = await User.findById(req.user.id);
 user.balance += 50;
 await user.save();
 res.json({ success: true, reward: 50, message: 'Bonus code applied! +$50' });
 } else {
 res.status(400).json({ error: 'Invalid bonus code' });
 }
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Get announcements
app.get('/api/announcements', verifyToken, async (req, res) => {
 try {
 const announcements = await Announcement.find({
 $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }]
 }).sort({ createdAt: -1 }).limit(10);
 res.json(announcements);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Play Slot Dice
app.post('/api/play-slot', verifyToken, async (req, res) => {
 try {
 if (req.user.role === 'admin') {
 return res.status(400).json({ error: 'Admin cannot play' });
 }
 
 const { stake } = req.body;
 if (!stake || stake < 5) {
 return res.status(400).json({ error: 'Minimum stake is $5' });
 }
 
 const user = await User.findById(req.user.id);
 if (!user) {
 return res.status(404).json({ error: 'User not found' });
 }
 
 if (user.balance < stake) {
 return res.status(400).json({ error: 'Insufficient balance' });
 }
 
 const bonusSettings = await BonusSettings.findOne() || {};
 const rollsRequired = bonusSettings.rollsRequired || { double1:30, double2:25, double3:25, double4:20, double5:15, double6:50 };
 const bonusMultipliers = bonusSettings.bonusMultipliers || { double1:8, double2:6, double3:6, double4:8, double5:10, double6:25 };
 
 let tracker = await BonusTracker.findOne({ userId: user.id });
 if (!tracker) {
 tracker = new BonusTracker({ userId: user.id });
 }
 tracker.rollsSinceLastBonus += 1;
 
 // Deduct stake
 user.balance -= stake;
 user.totalBets = (user.totalBets || 0) + stake;
 
 // Roll dice
 const dice1 = Math.floor(Math.random() * 6) + 1;
 const dice2 = Math.floor(Math.random() * 6) + 1;
 
 let multiplier = 0;
 let win = false;
 let isBonus = false;
 let isJackpot = false;
 let bonusMessage = '';
 let winAmount = 0;
 
 // Check for double (same number) - ALWAYS WIN ON DOUBLES
 if (dice1 === dice2) {
 if (dice1 === 1) {
 multiplier = bonusMultipliers.double1;
 win = true;
 if (tracker.rollsSinceLastBonus >= rollsRequired.double1) {
 isBonus = true;
 multiplier = bonusMultipliers.double1 * 2;
 tracker.rollsSinceLastBonus = 0;
 bonusMessage = ' BONUS! ';
 }
 } else if (dice1 === 2) {
 multiplier = bonusMultipliers.double2;
 win = true;
 if (tracker.rollsSinceLastBonus >= rollsRequired.double2) {
 isBonus = true;
 multiplier = bonusMultipliers.double2 * 2;
 tracker.rollsSinceLastBonus = 0;
 bonusMessage = ' BONUS! ';
 }
 } else if (dice1 === 3) {
 multiplier = bonusMultipliers.double3;
 win = true;
 if (tracker.rollsSinceLastBonus >= rollsRequired.double3) {
 isBonus = true;
 multiplier = bonusMultipliers.double3 * 2;
 tracker.rollsSinceLastBonus = 0;
 bonusMessage = ' BONUS! ';
 }
 } else if (dice1 === 4) {
 multiplier = bonusMultipliers.double4;
 win = true;
 if (tracker.rollsSinceLastBonus >= rollsRequired.double4) {
 isBonus = true;
 multiplier = bonusMultipliers.double4 * 2;
 tracker.rollsSinceLastBonus = 0;
 bonusMessage = ' BONUS! ';
 }
 } else if (dice1 === 5) {
 multiplier = bonusMultipliers.double5;
 win = true;
 if (tracker.rollsSinceLastBonus >= rollsRequired.double5) {
 isBonus = true;
 multiplier = bonusMultipliers.double5 * 2;
 tracker.rollsSinceLastBonus = 0;
 bonusMessage = ' BONUS! ';
 }
 } else if (dice1 === 6) {
 multiplier = bonusMultipliers.double6;
 win = true;
 isJackpot = true;
 if (tracker.rollsSinceLastBonus >= rollsRequired.double6) {
 isBonus = true;
 multiplier = bonusMultipliers.double6 * 2;
 tracker.rollsSinceLastBonus = 0;
 bonusMessage = ' JACKPOT BONUS! ';
 } else {
 bonusMessage = ' JACKPOT! ';
 }
 }
 } else {
 // Check for random roll rewards (non-doubles) - ONLY WINS ON SPECIAL COMBINATIONS
 const randomMultiplier = await getRandomRollMultiplier(dice1, dice2);
 if (randomMultiplier > 0) {
 multiplier = randomMultiplier;
 win = true;
 bonusMessage = ' SPECIAL WIN! ';
 }
 }
 
 if (win) {
 winAmount = stake * multiplier;
 user.balance += winAmount;
 user.totalWins += 1;
 }
 
 await tracker.save();
 await user.save();
 
 // Save entry
 const entry = new Entry({
 userId: user.id,
 username: user.username,
 game: 'Slot Dice',
 code: `${dice1}${dice2}`,
 matches: dice1 === dice2 ? 2 : 0,
 rewardWon: winAmount,
 stake: stake
 });
 await entry.save();
 
 // Cashback on losses over $100
 let cashbackMessage = '';
 if (!win && stake > 100) {
 const cashback = stake * 0.1;
 user.balance += cashback;
 await user.save();
 cashbackMessage = ` Cashback: +$${cashback.toFixed(2)}!`;
 }
 
 let message = '';
 if (win) {
 message = ` You rolled ${dice1} and ${dice2}! Won $${winAmount.toFixed(2)}! (${multiplier}x)${bonusMessage}${cashbackMessage}`;
 } else {
 message = ` You rolled ${dice1} and ${dice2}. No match. You lost $${stake}.${cashbackMessage}`;
 }
 
 res.json({
 win: win,
 dice1: dice1,
 dice2: dice2,
 multiplier: multiplier,
 reward: winAmount,
 newBalance: user.balance,
 isBonus: isBonus,
 isJackpot: isJackpot,
 message: message
 });
 } catch (error) {
 console.error('Slot play error:', error);
 res.status(500).json({ error: error.message });
 }
});

// Play Lotto
app.post('/api/play', verifyToken, async (req, res) => {
 try {
 if (req.user.role === 'admin') {
 return res.status(400).json({ error: 'Admin cannot play' });
 }
 
 const { code, stake } = req.body;
 if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
 return res.status(400).json({ error: 'Enter valid 6-digit code' });
 }
 
 const user = await User.findById(req.user.id);
 if (!user) {
 return res.status(404).json({ error: 'User not found' });
 }
 
 if (user.balance < stake) {
 return res.status(400).json({ error: 'Insufficient balance' });
 }
 
 // Deduct stake first
 user.balance -= stake;
 user.totalBets = (user.totalBets || 0) + stake;
 
 // Check if this code was already won by this user
 const existingWin = await Entry.findOne({ 
 userId: user.id, 
 code: code, 
 rewardWon: { $gt: 0 } 
 });
 
 let totalReward = 0;
 let bestMatch = 0;
 
 // Only check winning codes if they haven't won this code before
 if (!existingWin) {
 const winningCodes = await WinningCode.find({
 $or: [{ expiry: { $exists: false } }, { expiry: { $gt: new Date() } }]
 });
 
 for (const winCode of winningCodes) {
 const matches = calculateMatches(winCode.code, code);
 if (matches > bestMatch) {
 bestMatch = matches;
 }
 if (bestMatch >= 3) {
 const percentage = getRewardPercentage(bestMatch);
 totalReward = winCode.reward * percentage;
 user.balance += totalReward;
 user.totalWins += 1;
 break;
 }
 }
 }
 
 await user.save();
 
 const entry = new Entry({
 userId: user.id,
 username: user.username,
 game: 'Lotto',
 code: code,
 matches: bestMatch,
 rewardWon: totalReward,
 stake: stake
 });
 await entry.save();
 
 let message = '';
 if (existingWin) {
 message = ` You've already won with code ${code} before! Try a different code. You lost $${stake}.`;
 } else if (totalReward > 0) {
 message = ` You matched ${bestMatch}/6 digits! Won $${totalReward.toFixed(2)}!`;
 } else {
 message = ` Wrong guess! You lost $${stake}. No matches found.`;
 }
 
 res.json({
 win: totalReward > 0,
 matches: bestMatch,
 reward: totalReward,
 newBalance: user.balance,
 message: message
 });
 } catch (error) {
 console.error('Play error:', error);
 res.status(500).json({ error: error.message });
 }
});

// Get history
app.get('/api/history', verifyToken, async (req, res) => {
 try {
 let entries;
 if (req.user.role === 'admin') {
 entries = await Entry.find().sort({ date: -1 }).limit(100);
 } else {
 entries = await Entry.find({ userId: req.user.id }).sort({ date: -1 }).limit(50);
 }
 res.json(entries);
 } catch (error) {
 console.error('History error:', error);
 res.status(500).json({ error: error.message });
 }
});

// Withdraw
app.post('/api/withdraw', verifyToken, async (req, res) => {
 try {
 if (req.user.role === 'admin') {
 return res.status(400).json({ error: 'Admin cannot withdraw' });
 }
 
 const { amount, bankDetails, speed } = req.body;
 const user = await User.findById(req.user.id);
 
 if (!user) {
 return res.status(404).json({ error: 'User not found' });
 }
 
 let fee = 0;
 if (speed === 'express') fee = amount * 0.05;
 else if (speed === 'instant') fee = amount * 0.02;
 
 const totalDeduction = amount + fee;
 
 if (amount <= 0 || totalDeduction > user.balance) {
 return res.status(400).json({ error: 'Invalid withdrawal amount' });
 }
 
 const withdrawal = new Withdrawal({
 userId: user.id,
 username: user.username,
 amount: amount,
 method: bankDetails.method,
 address: bankDetails.address,
 speed: speed || 'standard',
 fee: fee,
 status: 'pending'
 });
 await withdrawal.save();
 
 // Record in history
 const entry = new Entry({
 userId: user.id,
 username: user.username,
 game: 'Withdraw',
 code: 'pending',
 rewardWon: 0,
 stake: amount
 });
 await entry.save();
 
 res.json({ message: `Withdrawal request submitted. Fee: $${fee.toFixed(2)}. Awaiting admin approval.` });
 } catch (error) {
 console.error('Withdrawal error:', error);
 res.status(500).json({ error: error.message });
 }
});

// Request deposit
app.post('/api/request-deposit', verifyToken, async (req, res) => {
 try {
 if (req.user.role === 'admin') {
 return res.status(400).json({ error: 'Admin cannot deposit' });
 }
 
 const { amount, method } = req.body;
 const user = await User.findById(req.user.id);
 
 if (!user) {
 return res.status(404).json({ error: 'User not found' });
 }
 
 if (amount < 10) {
 return res.status(400).json({ error: 'Minimum deposit is $10' });
 }
 
 const deposit = new Deposit({
 userId: user.id,
 username: user.username,
 amount: amount,
 method: method
 });
 await deposit.save();
 
 // Record in history
 const entry = new Entry({
 userId: user.id,
 username: user.username,
 game: 'Deposit',
 code: 'pending',
 rewardWon: 0,
 stake: amount
 });
 await entry.save();
 
 res.json({ message: 'Deposit request submitted. Awaiting admin approval.' });
 } catch (error) {
 console.error('Deposit error:', error);
 res.status(500).json({ error: error.message });
 }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
 try {
 const users = await User.find({ status: 'approved' })
 .sort({ totalWins: -1, balance: -1 })
 .limit(10)
 .select('name username totalWins balance vipTier');
 res.json(users);
 } catch (error) {
 console.error('Leaderboard error:', error);
 res.status(500).json({ error: error.message });
 }
});

// Winning codes (public)
app.get('/api/winning-codes', async (req, res) => {
 try {
 const codes = await WinningCode.find({
 $or: [{ expiry: { $exists: false } }, { expiry: { $gt: new Date() } }]
 }).select('code reward expiry');
 res.json(codes);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Payment settings (public)
app.get('/api/payment-settings-public', async (req, res) => {
 try {
 let settings = await PaymentSettings.findOne();
 if (!settings) {
 settings = {
 cryptoWallets: {
 usdt: 'TX7hH3kL9mN4pQ2rS5tU6vW7xY8zA9bC0dE1fG',
 btc: '1A2b3C4d5E6f7G8h9I0jK1lL2mM3nN4oO5pP'
 },
 bankDetails: {
 bankName: 'Global Bank',
 accountName: 'LottoMaster Gaming',
 accountNumber: '1234567890',
 routingNumber: '987654321',
 swiftCode: 'GLBANK22'
 }
 };
 }
 res.json(settings);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Referral info
app.get('/api/referral-info', verifyToken, async (req, res) => {
 try {
 const user = await User.findById(req.user.id);
 const referrals = await Referral.find({ userId: user.id }).populate('referredUserId', 'username');
 
 res.json({
 referralCode: user.referralCode,
 referralLink: `${req.protocol}://${req.get('host')}/signup?ref=${user.referralCode}`,
 totalCommission: user.commissionBalance || 0,
 totalEarned: user.totalCommissionEarned || 0,
 referrals: referrals.map(r => ({
 username: r.referredUserId?.username || 'Unknown',
 date: r.createdAt,
 commission: r.commissionEarned,
 status: r.status
 }))
 });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// VIP benefits
app.get('/api/vip-benefits', async (req, res) => {
 res.json({
 Bronze: { minBets: 0, withdrawalLimit: 5000, cashback: 0, bonusMultiplier: 1 },
 Silver: { minBets: 1000, withdrawalLimit: 10000, cashback: 2, bonusMultiplier: 1.05 },
 Gold: { minBets: 5000, withdrawalLimit: 25000, cashback: 5, bonusMultiplier: 1.1 },
 Platinum: { minBets: 10000, withdrawalLimit: 100000, cashback: 10, bonusMultiplier: 1.2 }
 });
});

// User stats
app.get('/api/user-stats', verifyToken, async (req, res) => {
 try {
 const user = await User.findById(req.user.id);
 const entries = await Entry.find({ userId: req.user.id });
 
 const losses = entries.filter(e => e.rewardWon === 0 && e.game !== 'Deposit' && e.game !== 'Withdraw').length;
 const gameStats = {
 totalWins: user.totalWins,
 totalLosses: losses,
 winLossRatio: losses > 0 ? (user.totalWins / losses).toFixed(2) : user.totalWins,
 mostPlayedGame: 'Slot Dice',
 averageBetSize: (entries.reduce((sum, e) => sum + (e.stake || 0), 0) / (entries.length || 1)).toFixed(2),
 sessionDuration: Math.floor((Date.now() - new Date(user.lastActive).getTime()) / 60000)
 };
 
 res.json(gameStats);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// ============ ADMIN ROUTES ============

// User management
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
 try {
 const users = await User.find().select('-password');
 res.json(users);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/admin/approve-user', verifyAdmin, async (req, res) => {
 try {
 const { userId } = req.body;
 const user = await User.findById(userId);
 if (!user) {
 return res.status(404).json({ error: 'User not found' });
 }
 
 user.status = 'approved';
 if (user.balance === 0) user.balance = 75;
 await user.save();
 
 console.log(' User approved:', user.username);
 res.json({ message: 'User approved' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/admin/disable-user', verifyAdmin, async (req, res) => {
 try {
 const { userId, disabled } = req.body;
 const user = await User.findById(userId);
 if (!user) {
 return res.status(404).json({ error: 'User not found' });
 }
 
 user.status = disabled ? 'disabled' : 'approved';
 await user.save();
 
 res.json({ message: `User ${disabled ? 'disabled' : 'enabled'}` });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/admin/boost-balance', verifyAdmin, async (req, res) => {
 try {
 const { userId, amount } = req.body;
 const user = await User.findById(userId);
 if (!user) {
 return res.status(404).json({ error: 'User not found' });
 }
 
 user.balance += amount;
 await user.save();
 
 res.json({ message: `Added $${amount}`, newBalance: user.balance });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Withdrawal admin routes
app.get('/api/admin/withdrawals', verifyAdmin, async (req, res) => {
 try {
 const withdrawals = await Withdrawal.find().sort({ requestedAt: -1 });
 res.json(withdrawals);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/admin/approve-withdrawal', verifyAdmin, async (req, res) => {
 try {
 const { withdrawalId } = req.body;
 const withdrawal = await Withdrawal.findById(withdrawalId);
 if (!withdrawal) {
 return res.status(404).json({ error: 'Withdrawal not found' });
 }
 
 withdrawal.status = 'approved';
 withdrawal.approvedAt = new Date();
 await withdrawal.save();
 
 const user = await User.findById(withdrawal.userId);
 if (user) {
 const totalDeduction = withdrawal.amount + withdrawal.fee;
 user.balance -= totalDeduction;
 await user.save();
 }
 
 await Entry.findOneAndUpdate(
 { userId: withdrawal.userId, game: 'Withdraw', code: 'pending' },
 { code: 'approved', rewardWon: withdrawal.amount }
 );
 
 res.json({ message: 'Withdrawal approved' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/admin/reject-withdrawal', verifyAdmin, async (req, res) => {
 try {
 const { withdrawalId } = req.body;
 const withdrawal = await Withdrawal.findById(withdrawalId);
 if (!withdrawal) {
 return res.status(404).json({ error: 'Withdrawal not found' });
 }
 
 withdrawal.status = 'rejected';
 await withdrawal.save();
 
 await Entry.findOneAndUpdate(
 { userId: withdrawal.userId, game: 'Withdraw', code: 'pending' },
 { code: 'rejected' }
 );
 
 res.json({ message: 'Withdrawal rejected' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Deposit admin routes
app.get('/api/admin/pending-deposits', verifyAdmin, async (req, res) => {
 try {
 const deposits = await Deposit.find({ status: 'pending' }).sort({ requestedAt: -1 });
 res.json(deposits);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.get('/api/admin/all-deposits', verifyAdmin, async (req, res) => {
 try {
 const deposits = await Deposit.find().sort({ requestedAt: -1 });
 res.json(deposits);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/admin/approve-deposit', verifyAdmin, async (req, res) => {
 try {
 const { depositId, transactionId } = req.body;
 const deposit = await Deposit.findById(depositId);
 if (!deposit) {
 return res.status(404).json({ error: 'Deposit not found' });
 }
 
 deposit.status = 'approved';
 deposit.transactionId = transactionId;
 deposit.approvedAt = new Date();
 await deposit.save();
 
 const user = await User.findById(deposit.userId);
 user.balance += deposit.amount;
 
 if (user.referredBy) {
 const referrer = await User.findById(user.referredBy);
 if (referrer) {
 const commission = deposit.amount * 0.05;
 referrer.commissionBalance += commission;
 referrer.totalCommissionEarned += commission;
 await referrer.save();
 
 const referral = await Referral.findOne({ userId: referrer.id, referredUserId: user.id });
 if (referral) {
 referral.commissionEarned = commission;
 referral.status = 'completed';
 await referral.save();
 }
 }
 }
 
 await user.save();
 
 await Entry.findOneAndUpdate(
 { userId: deposit.userId, game: 'Deposit', code: 'pending' },
 { code: 'approved', rewardWon: deposit.amount }
 );
 
 res.json({ message: 'Deposit approved and balance updated' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/admin/reject-deposit', verifyAdmin, async (req, res) => {
 try {
 const { depositId } = req.body;
 const deposit = await Deposit.findById(depositId);
 if (!deposit) {
 return res.status(404).json({ error: 'Deposit not found' });
 }
 
 deposit.status = 'rejected';
 await deposit.save();
 
 await Entry.findOneAndUpdate(
 { userId: deposit.userId, game: 'Deposit', code: 'pending' },
 { code: 'rejected' }
 );
 
 res.json({ message: 'Deposit rejected' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Winning codes admin routes
app.get('/api/admin/winning-codes', verifyAdmin, async (req, res) => {
 try {
 const codes = await WinningCode.find().sort({ createdAt: -1 });
 res.json(codes);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/admin/set-winner', verifyAdmin, async (req, res) => {
 try {
 const { code, reward, expiryDays } = req.body;
 
 if (!code || code.length !== 6 || !reward) {
 return res.status(400).json({ error: 'Valid 6-digit code and reward required' });
 }
 
 const expiry = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;
 
 const winningCode = new WinningCode({
 code,
 reward,
 expiry,
 createdBy: req.admin.username
 });
 await winningCode.save();
 
 res.json({ message: `Winning code ${code} set with reward $${reward}` });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.delete('/api/admin/winning-code/:id', verifyAdmin, async (req, res) => {
 try {
 await WinningCode.findByIdAndDelete(req.params.id);
 res.json({ message: 'Winning code deleted' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Payment settings admin routes
app.get('/api/admin/payment-settings', verifyAdmin, async (req, res) => {
 try {
 const settings = await PaymentSettings.findOne();
 res.json(settings || {});
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/admin/update-payment-settings', verifyAdmin, async (req, res) => {
 try {
 const { cryptoWallets, bankDetails } = req.body;
 let settings = await PaymentSettings.findOne();
 
 if (!settings) {
 settings = new PaymentSettings();
 }
 
 if (cryptoWallets) {
 if (cryptoWallets.usdt) settings.cryptoWallets.usdt = cryptoWallets.usdt;
 if (cryptoWallets.btc) settings.cryptoWallets.btc = cryptoWallets.btc;
 }
 if (bankDetails) {
 if (bankDetails.bankName) settings.bankDetails.bankName = bankDetails.bankName;
 if (bankDetails.accountName) settings.bankDetails.accountName = bankDetails.accountName;
 if (bankDetails.accountNumber) settings.bankDetails.accountNumber = bankDetails.accountNumber;
 if (bankDetails.routingNumber) settings.bankDetails.routingNumber = bankDetails.routingNumber;
 if (bankDetails.swiftCode) settings.bankDetails.swiftCode = bankDetails.swiftCode;
 }
 settings.updatedAt = new Date();
 await settings.save();
 
 res.json({ message: 'Payment settings updated' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Bonus settings admin routes
app.get('/api/admin/bonus-settings', verifyAdmin, async (req, res) => {
 try {
 const settings = await BonusSettings.findOne();
 res.json(settings || {});
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/admin/update-bonus-settings', verifyAdmin, async (req, res) => {
 try {
 const { rollsRequired, bonusMultipliers } = req.body;
 let settings = await BonusSettings.findOne();
 
 if (!settings) {
 settings = new BonusSettings();
 }
 
 if (rollsRequired) settings.rollsRequired = rollsRequired;
 if (bonusMultipliers) settings.bonusMultipliers = bonusMultipliers;
 settings.updatedAt = new Date();
 await settings.save();
 
 res.json({ message: 'Bonus settings updated' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Random roll rewards admin routes
app.get('/api/admin/random-roll-rewards', verifyAdmin, async (req, res) => {
 try {
 const settings = await RandomRollRewards.findOne();
 res.json(settings || { enabled: true, rewards: {
 sum3: 1.5, sum4: 1.5, sum5: 2, sum6: 2, sum7: 2.5, sum8: 2.5, sum9: 3, sum10: 3, sum11: 3.5,
 consecutives: 2, sameParity: 1.5
 } });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/admin/update-random-roll-rewards', verifyAdmin, async (req, res) => {
 try {
 const { enabled, rewards } = req.body;
 let settings = await RandomRollRewards.findOne();
 
 if (!settings) {
 settings = new RandomRollRewards();
 }
 
 if (enabled !== undefined) settings.enabled = enabled;
 if (rewards) {
 if (rewards.sum3 !== undefined) settings.rewards.sum3 = rewards.sum3;
 if (rewards.sum4 !== undefined) settings.rewards.sum4 = rewards.sum4;
 if (rewards.sum5 !== undefined) settings.rewards.sum5 = rewards.sum5;
 if (rewards.sum6 !== undefined) settings.rewards.sum6 = rewards.sum6;
 if (rewards.sum7 !== undefined) settings.rewards.sum7 = rewards.sum7;
 if (rewards.sum8 !== undefined) settings.rewards.sum8 = rewards.sum8;
 if (rewards.sum9 !== undefined) settings.rewards.sum9 = rewards.sum9;
 if (rewards.sum10 !== undefined) settings.rewards.sum10 = rewards.sum10;
 if (rewards.sum11 !== undefined) settings.rewards.sum11 = rewards.sum11;
 if (rewards.consecutives !== undefined) settings.rewards.consecutives = rewards.consecutives;
 if (rewards.sameParity !== undefined) settings.rewards.sameParity = rewards.sameParity;
 }
 settings.updatedAt = new Date();
 await settings.save();
 
 res.json({ message: 'Random roll rewards updated successfully' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Announcement admin routes
app.post('/api/admin/send-announcement', verifyAdmin, async (req, res) => {
 try {
 const { title, message, expiresInDays } = req.body;
 
 const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;
 
 const announcement = new Announcement({
 userId: null,
 username: 'All Users',
 title: title,
 message: message,
 createdBy: req.admin.username,
 expiresAt: expiresAt
 });
 await announcement.save();
 
 res.json({ message: 'Announcement sent to all users' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.get('/api/admin/announcements', verifyAdmin, async (req, res) => {
 try {
 const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(100);
 res.json(announcements);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.delete('/api/admin/announcement/:id', verifyAdmin, async (req, res) => {
 try {
 await Announcement.findByIdAndDelete(req.params.id);
 res.json({ message: 'Announcement deleted' });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Entries admin route
app.get('/api/admin/entries', verifyAdmin, async (req, res) => {
 try {
 const entries = await Entry.find().sort({ date: -1 }).limit(200);
 res.json(entries);
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// Analytics admin route
app.get('/api/admin/analytics', verifyAdmin, async (req, res) => {
 try {
 const totalUsers = await User.countDocuments();
 const totalDeposits = await Deposit.aggregate([
 { $match: { status: 'approved' } },
 { $group: { _id: null, total: { $sum: '$amount' } } }
 ]);
 const totalWithdrawals = await Withdrawal.aggregate([
 { $match: { status: 'approved' } },
 { $group: { _id: null, total: { $sum: '$amount' } } }
 ]);
 
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const dailyRevenue = await Deposit.aggregate([
 { $match: { status: 'approved', approvedAt: { $gte: today } } },
 { $group: { _id: null, total: { $sum: '$amount' } } }
 ]);
 
 res.json({
 totalUsers,
 totalDeposits: totalDeposits[0]?.total || 0,
 totalWithdrawals: totalWithdrawals[0]?.total || 0,
 netRevenue: (totalDeposits[0]?.total || 0) - (totalWithdrawals[0]?.total || 0),
 dailyRevenue: dailyRevenue[0]?.total || 0
 });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// ============ SERVE HTML FILES ============

app.get('/login', (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ START SERVER ============

async function startServer() {
 try {
 await initAdmin();
 await initWinningCodes();
 await initPaymentSettings();
 await initBonusSettings();
 await initRandomRollRewards();
 
 const PORT = process.env.PORT || 3000;
 app.listen(PORT, '0.0.0.0', () => {
 console.log(`
╔══════════════════════════════════════════════════════════╗
║ LOTTO WEBSITE WITH MONGODB RUNNING ║
╠══════════════════════════════════════════════════════════╣
║ Server: http://localhost:${PORT} ║
║ Login: http://localhost:${PORT}/login ║
║ Admin: http://localhost:${PORT}/admin ║
║ Admin Login: admin / admin123 ║
║ ║
║ Admin winning codes working ║
║ Random roll rewards working ║
║ Bonus settings working ║
║ Not all dice rolls win (only doubles & specials) ║
╚══════════════════════════════════════════════════════════╝
 `);
 });
 } catch (error) {
 console.error('Failed to start server:', error);
 }
}

startServer();