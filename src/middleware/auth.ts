import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'zyron-super-secret-key-123';

export interface AuthRequest extends Request {
  user?: any; // We attach the DB user object here
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; email: string; role: string };
    
    // Get user from DB
    const result = await db.select().from(users).where(eq(users.uid, decoded.uid));
    const dbUser = result[0];
    
    if (!dbUser) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    const adminEmails = ['admin@zyron.events', 'sakethma007@gmail.com', 'zyronproductions@gmail.com'];
    if (dbUser.email && adminEmails.includes(dbUser.email.toLowerCase().trim()) && dbUser.role !== 'admin') {
      dbUser.role = 'admin';
      await db.update(users).set({ role: 'admin' }).where(eq(users.uid, dbUser.uid));
    }
    
    req.user = { ...dbUser, id: dbUser.uid };
    next();
  } catch (error: any) {
    console.error('JWT verification failed:', error.message || error, error.cause ? ('Cause: ' + JSON.stringify(error.cause)) : '');
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  await requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admins only.' });
    }
    next();
  });
};

export async function getOrCreateUser(uid: string, email: string) {
  const normalizedEmail = email?.toLowerCase().trim() || '';
  const isAdmin = ['admin@zyron.events', 'sakethma007@gmail.com', 'zyronproductions@gmail.com'].includes(normalizedEmail);
  const result = await db.insert(users)
    .values({
      uid,
      email: normalizedEmail,
      role: isAdmin ? 'admin' : 'user'
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: { 
        email: normalizedEmail,
        role: isAdmin ? 'admin' : 'user'
      },
    })
    .returning();
  return result[0];
}
