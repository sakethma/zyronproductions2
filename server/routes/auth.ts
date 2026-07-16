import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db as drizzleDb } from '../../src/db/index.ts';
import { users } from '../../src/db/schema.ts';
import { requireAuth, getJwtSecret, AuthRequest } from '../middleware/auth.ts';
import { rateLimiter } from '../middleware/rateLimit.ts';
import { sendMail } from '../services/email.ts';

const router = Router();
const JWT_SECRET = getJwtSecret();

// Password recovery map (in-memory)
const resetCodes = new Map<string, { code: string; expiresAt: number }>();

router.post('/register', rateLimiter(15 * 60 * 1000, 10), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const normalizedEmail = email.trim().toLowerCase();
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  
  try {
    const existing = await drizzleDb.select().from(users).where(eq(users.email, normalizedEmail));
    
    let user;
    if (existing.length > 0) {
      const firstWithNull = existing.find(u => !u.password_hash);
      if (firstWithNull) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const updated = await drizzleDb.update(users)
          .set({ password_hash: hashedPassword })
          .where(eq(users.id, firstWithNull.id))
          .returning();
        user = updated[0];
      } else {
        return res.status(400).json({ error: 'Email already exists' });
      }
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const uid = 'uid-' + Date.now() + '-' + Math.floor(Math.random()*1000);
      const adminEmails = ['admin@zyron.events', 'sakethma007@gmail.com', 'zyronproductions@gmail.com'];
      const role = adminEmails.includes(normalizedEmail) ? 'admin' : 'user';
      
      const newUser = await drizzleDb.insert(users).values({
        uid,
        email: normalizedEmail,
        password_hash: hashedPassword,
        role
      }).returning();
      user = newUser[0];
    }
    
    const token = jwt.sign({ uid: user.uid, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ user, token });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/login', rateLimiter(5 * 60 * 1000, 20), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    const existing = await drizzleDb.select().from(users).where(eq(users.email, normalizedEmail));
    if (existing.length === 0) return res.status(400).json({ error: 'Invalid email or password' });
    
    const userWithPassword = existing.find(u => !!u.password_hash);
    if (!userWithPassword) return res.status(400).json({ error: 'Invalid email or password' });
    
    const match = await bcrypt.compare(password, userWithPassword.password_hash);
    if (!match) return res.status(400).json({ error: 'Invalid email or password' });

    const user = userWithPassword;
    const adminEmails = ['admin@zyron.events', 'sakethma007@gmail.com', 'zyronproductions@gmail.com'];
    if (user.email && adminEmails.includes(user.email.toLowerCase().trim()) && user.role !== 'admin') {
      user.role = 'admin';
      await drizzleDb.update(users).set({ role: 'admin' }).where(eq(users.uid, user.uid));
    }
    
    const token = jwt.sign({ uid: user.uid, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ user, token });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    const existing = await drizzleDb.select().from(users).where(eq(users.email, normalizedEmail));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'No user registered with this email address' });
    }
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    
    resetCodes.set(normalizedEmail, { code, expiresAt });
    console.log(`[PASSWORD RESET SUCCESS] Generated code ${code} for user: ${normalizedEmail}`);
    
    let emailSent = false;
    let emailErrorMsg = '';
    
    const emailResult = await sendMail({
      to: normalizedEmail,
      subject: 'Your Zyron Productions Reset Code',
      text: `Your password reset code is: ${code}\n\nThis code is valid for 15 minutes. Use it to securely reset your password.`
    });
    
    if (emailResult.success) {
      emailSent = true;
    } else {
      emailErrorMsg = emailResult.error || 'Configuration or delivery error';
    }
    
    return res.json({ 
      success: true, 
      message: emailSent 
        ? 'A secure 6-digit verification code has been sent to your email.' 
        : `Verification code generated. (Email delivery failed: ${emailErrorMsg}. Use code: ${code} to proceed).`,
      code: emailSent ? undefined : code
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, code, and new password are required' });
  }
  
  const normalizedEmail = email.trim().toLowerCase();
  const cached = resetCodes.get(normalizedEmail);
  
  if (!cached) {
    return res.status(400).json({ error: 'No active reset request found for this email' });
  }
  
  if (cached.code !== code.trim()) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }
  
  if (Date.now() > cached.expiresAt) {
    resetCodes.delete(normalizedEmail);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }
  
  try {
    const existing = await drizzleDb.select().from(users).where(eq(users.email, normalizedEmail));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User no longer exists' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await drizzleDb.update(users)
      .set({ password_hash: hashedPassword })
      .where(eq(users.email, normalizedEmail));
      
    resetCodes.delete(normalizedEmail);
    console.log(`[PASSWORD RESET SUCCESS] Successfully reset password for user: ${normalizedEmail}`);
    
    return res.json({ success: true, message: 'Password has been successfully updated.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('session_token', { sameSite: 'none', secure: true });
  return res.json({ success: true });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  return res.json({ user: req.user });
});

export default router;
