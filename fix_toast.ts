import fs from 'fs';

const file = 'src/components/TicketGenerator.tsx';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace("import { toast } from 'react-hot-toast';", "");

// add state
code = code.replace("const [loading, setLoading] = useState(false);", "const [loading, setLoading] = useState(false);\n  const [toastMsg, setToastMsg] = useState<string | null>(null);\n\n  const showToast = (msg: string) => {\n    setToastMsg(msg);\n    setTimeout(() => setToastMsg(null), 3000);\n  };");

code = code.replace(/toast\.success\(/g, "showToast(");
code = code.replace(/toast\.error\(/g, "showToast(");

// add toast UI
const toastUI = `
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border border-neutral-800 py-3.5 px-5 font-mono text-xs flex items-center shadow-md">
          <span>{toastMsg}</span>
        </div>
      )}
`;

code = code.replace("return (", "return (\n" + toastUI);

fs.writeFileSync(file, code);
console.log('Fixed toast');
