const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  "import { eq, desc } from 'drizzle-orm';",
  "import { eq, desc, and, isNull } from 'drizzle-orm';"
);
code = code.replace(
  "eq(bookings.cancelled_at, null)",
  "isNull(bookings.cancelled_at)"
);

fs.writeFileSync('server.ts', code);
