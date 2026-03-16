import { spawn } from 'child_process'
import electron from 'electron'

// Remove env vars that force Electron into Node.js mode
// (e.g. ELECTRON_RUN_AS_NODE=1 injected by IDE terminals)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_NO_ATTACH_CONSOLE

const child = spawn(electron, ['.'], { stdio: 'inherit', env })
child.on('close', (code) => process.exit(code ?? 0))
