import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { getDBStatus } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure local persistence directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to read local JSON store
const readLocalUsers = () => {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('[UserStore] Error reading local user store:', err.message);
    return [];
  }
};

// Helper to write local JSON store atomically
const writeLocalUsers = (users) => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('[UserStore] Error writing local user store:', err.message);
  }
};

// Seed demo farmer account persistently if file is empty
const initLocalStore = async () => {
  const users = readLocalUsers();
  const demoEmail = 'demo@agritech.com';
  const existing = users.find((u) => u.email.toLowerCase() === demoEmail);

  if (!existing) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Farmer123!', salt);
    users.push({
      _id: 'mock-farmer-001',
      id: 'mock-farmer-001',
      name: 'Ramesh Patel',
      email: demoEmail,
      password: hashedPassword,
      role: 'farmer',
      farmName: 'Surya Organic Farm',
      farmSizeHectares: 25,
      primaryCrops: ['Wheat', 'Mustard', 'Barley'],
      location: { region: 'Punjab', country: 'India' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    writeLocalUsers(users);
  }
};
initLocalStore();

export const userStore = {
  // Find user by email
  async findByEmail(email) {
    const normalized = email.toLowerCase().trim();
    const dbStatus = getDBStatus();

    if (dbStatus.isConnected) {
      return User.findOne({ email: normalized });
    }

    const users = readLocalUsers();
    return users.find((u) => u.email.toLowerCase() === normalized) || null;
  },

  // Find user by ID
  async findById(id) {
    const dbStatus = getDBStatus();

    if (dbStatus.isConnected) {
      return User.findById(id).select('-password');
    }

    const users = readLocalUsers();
    const found = users.find((u) => u.id === id || u._id === id);
    if (!found) return null;

    const sanitized = { ...found };
    delete sanitized.password;
    return sanitized;
  },

  // Create a new user with password hashing
  async create(userData) {
    const dbStatus = getDBStatus();

    if (dbStatus.isConnected) {
      return User.create(userData);
    }

    const users = readLocalUsers();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    const newId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newUser = {
      _id: newId,
      id: newId,
      name: userData.name,
      email: userData.email.toLowerCase().trim(),
      password: hashedPassword,
      role: userData.role || 'farmer',
      farmName: userData.farmName || 'My Farm',
      farmSizeHectares: Number(userData.farmSizeHectares) || 10,
      primaryCrops: Array.isArray(userData.primaryCrops) ? userData.primaryCrops : ['Wheat'],
      location: userData.location || { region: 'Central Plains', country: 'India' },
      createdAt: now,
      updatedAt: now
    };

    users.push(newUser);
    writeLocalUsers(users);

    return newUser;
  },

  // Verify password
  async verifyPassword(user, candidatePassword) {
    if (typeof user.comparePassword === 'function') {
      return user.comparePassword(candidatePassword);
    }
    return bcrypt.compare(candidatePassword, user.password);
  },

  // Check if email exists
  async emailExists(email) {
    const user = await this.findByEmail(email);
    return !!user;
  }
};

export default userStore;
