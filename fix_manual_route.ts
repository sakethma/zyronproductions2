import fs from 'fs';

const file = 'server/routes/admin.ts';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace(
  "checked_in: false,\n    }).returning();",
  "checked_in: false,\n      created_at: new Date().toISOString(),\n      updated_at: new Date().toISOString(),\n    }).returning();"
);

fs.writeFileSync(file, code);
console.log('Fixed manual route');
