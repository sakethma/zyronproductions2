const fs = require('fs');
let code = fs.readFileSync('src/middleware/auth.ts', 'utf-8');

code = code.replace(
  'req.user = dbUser;',
  'req.user = { ...dbUser, id: dbUser.uid };'
);

fs.writeFileSync('src/middleware/auth.ts', code);
