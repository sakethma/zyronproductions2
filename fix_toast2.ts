import fs from 'fs';

const file = 'src/components/TicketGenerator.tsx';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace("return (\n\n      {/* Toast */}", "return (\n    <>\n      {/* Toast */}").replace("  );\n}", "  );\n}\n");

// Add a closing fragment tag at the end. We need to wrap the whole component return.
// Let's just do it manually with sed or string replacement.

