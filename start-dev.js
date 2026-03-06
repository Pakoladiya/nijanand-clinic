const { spawn } = require('child_process')
const path = require('path')

const projectDir = path.join(__dirname)
const vite = path.join(projectDir, 'node_modules', 'vite', 'bin', 'vite.js')

const child = spawn(process.execPath, [vite, '--port', '5174'], {
  cwd: projectDir,
  stdio: 'inherit',
  env: process.env
})

child.on('exit', code => process.exit(code || 0))
