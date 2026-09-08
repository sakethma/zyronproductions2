import fs from 'fs';

const file = 'src/db/index.ts';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace(
  "if (process.env.DATABASE_URL) {",
  "if (process.env.DATABASE_URL && !process.env.SQL_HOST) {"
);

fs.writeFileSync(file, code);
console.log('Fixed DB priority');
