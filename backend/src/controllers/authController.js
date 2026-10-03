// backend/src/controllers/authController.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

const SALT_ROUNDS = 10;

// ---------- Helper: sign a JWT ----------
function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

// ---------- POST /api/auth/register ----------
export async function register(req, res) {
    try {
        const { email, password } = req.body;

        // 1. Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        const normalizedEmail = email.trim().toLowerCase();

        // 2. Check if user already exists
        const existing = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [normalizedEmail]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // 3. Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // 4. Insert user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
            [normalizedEmail, passwordHash]
        );

        const user = result.rows[0];

        // 5. Sign token and respond
        const token = signToken(user);

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: user.id, email: user.email },
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
}

// ---------- POST /api/auth/login ----------
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        // 1. Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const normalizedEmail = email.trim().toLowerCase();

        // 2. Find user
        const result = await pool.query(
            'SELECT id, email, password_hash FROM users WHERE email = $1',
            [normalizedEmail]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // 3. Compare password
        const matches = await bcrypt.compare(password, user.password_hash);
        if (!matches) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 4. Sign token and respond
        const token = signToken(user);

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
}

// ---------- GET /api/auth/me (protected) ----------
export async function me(req, res) {
    // req.user is set by the auth middleware
    res.json({ user: req.user });
}