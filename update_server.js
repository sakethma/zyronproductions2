import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

const authRoutes = `
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'zyron-super-secret-key-123';

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  try {
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) return res.status(400).json({ error: 'Email already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const uid = 'uid-' + Date.now() + '-' + Math.floor(Math.random()*1000);
    const role = (email === 'admin@zyron.events' || email === 'sakethma007@gmail.com') ? 'admin' : 'user';
    
    const newUser = await db.insert(users).values({
      uid,
      email,
      password_hash: hashedPassword,
      role
    }).returning();
    
    const user = newUser[0];
    const token = jwt.sign({ uid: user.uid, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    return res.json({ user, token });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  try {
    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length === 0) return res.status(400).json({ error: 'Invalid email or password' });
    
    const user = existing[0];
    if (!user.password_hash) return res.status(400).json({ error: 'Invalid email or password' });
    
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: 'Invalid email or password' });
    
    const token = jwt.sign({ uid: user.uid, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    return res.json({ user, token });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

`;

content = content.replace("app.post('/api/auth/logout',", authRoutes + "\napp.post('/api/auth/logout',");

fs.writeFileSync('server.ts', content);
