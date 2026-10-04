import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const backend = path.join(root, 'backend')
const windows = process.platform === 'win32'
const python = path.join(backend, '.venv', windows ? 'Scripts/python.exe' : 'bin/python')
const npmCli = process.env.npm_execpath
const action = process.argv[2]

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.error || result.status !== 0) {
    console.error(result.error?.message || `Command failed: ${command}`)
    process.exit(result.status || 1)
  }
}

if (action === 'setup') {
  const candidates = windows ? [['py', ['-3']], ['python', []]] : [['python3', []], ['python', []]]
  const selected = candidates.find(([command, args]) =>
    spawnSync(command, [...args, '-c', 'import sys; sys.exit(0 if sys.version_info.major == 3 else 1)']).status === 0)
  if (!selected) {
    console.error('Install the latest stable Python and ensure it is on PATH, then run npm run setup again.')
    process.exit(1)
  }
  run(process.execPath, [npmCli, 'ci'])
  if (!existsSync(python)) run(selected[0], [...selected[1], '-m', 'venv', path.join(backend, '.venv')])
  run(python, ['-m', 'pip', 'install', '-r', 'requirements.txt'], backend)
  console.log('\nSetup complete. Run npm run dev.')
} else if (['dev', 'backend', 'test'].includes(action)) {
  if (!existsSync(python)) {
    console.error('Backend environment missing. Run npm run setup first.')
    process.exit(1)
  }
  if (action === 'test') {
    run(python, ['-m', 'unittest', 'discover', '-s', 'tests'], backend)
  } else {
    const children = []
    let stopping = false
    function stop(code = 0) {
      if (stopping) return
      stopping = true
      process.exitCode = code
      for (const child of children) {
        if (child.exitCode !== null || !child.pid) continue
        if (windows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'])
        else {
          try { process.kill(-child.pid, 'SIGTERM') } catch (error) {
            if (error.code !== 'ESRCH') throw error
          }
        }
      }
    }
    function start(command, args, cwd) {
      const child = spawn(command, args, { cwd, stdio: 'inherit', detached: !windows })
      children.push(child)
      child.on('error', (error) => { console.error(error.message); stop(1) })
      child.on('exit', (code) => { if (!stopping) stop(code || 1) })
    }
    process.on('SIGINT', () => stop())
    process.on('SIGTERM', () => stop())
    start(python, ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000'], backend)
    if (action === 'dev') start(process.execPath, [npmCli, 'run', 'dev', '--workspace', 'frontend'], root)
  }
} else {
  console.error('Expected setup, dev, backend, or test.')
  process.exit(1)
}
