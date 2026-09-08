import fs from 'fs';

const file = 'src/components/TicketGenerator.tsx';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace("return (", "return (\n<>");
code = code.replace("  );\n}", "  </>\n  );\n}");

fs.writeFileSync(file, code);
console.log('Fixed fragment');
