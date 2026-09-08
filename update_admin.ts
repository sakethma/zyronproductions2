import fs from 'fs';

const file = 'src/pages/Admin.tsx';
let code = fs.readFileSync(file, 'utf-8');

// Import TicketGenerator
if (!code.includes("import TicketGenerator")) {
  code = code.replace("import QRScanner from '../components/QRScanner';", "import QRScanner from '../components/QRScanner';\nimport TicketGenerator from '../components/TicketGenerator';");
}

// Add generator to tab contents
const generatorBlock = `
      {activeTab === 'generator' && (
        <TicketGenerator events={events} />
      )}
`;

if (!code.includes("activeTab === 'generator' && (")) {
  code = code.replace("{activeTab === 'analytics' && (", generatorBlock + "\n      {activeTab === 'analytics' && (");
}

fs.writeFileSync(file, code);
console.log('Updated Admin.tsx');
