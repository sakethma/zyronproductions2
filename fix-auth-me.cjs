const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldAuthMe = `app.get('/api/auth/me', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.json({ user: null });
  }
  return res.json({ user: { id: user.id, email: user.email, role: user.role } });
});`;

const newAuthMe = `app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: any) => {
  return res.json({ user: req.user });
});`;

code = code.replace(oldAuthMe, newAuthMe);
fs.writeFileSync('server.ts', code);
