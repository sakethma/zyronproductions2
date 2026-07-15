const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// Fix fetchGuests to not flicker
code = code.replace('setLoadingGuests(true);', 'if (guests.length === 0) setLoadingGuests(true);');

fs.writeFileSync('src/pages/Admin.tsx', code);
