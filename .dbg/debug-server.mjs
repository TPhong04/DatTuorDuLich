import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const session = process.argv[2] || 'debug-session'
const portArg = Number(process.argv[3]) || 7777
const outDir = process.argv[4] || '.dbg'

const __filename = fileURLToPath(import.meta.url)
const scriptDir = path.dirname(__filename)
const workDir = path.resolve(scriptDir)
fs.mkdirSync(workDir, { recursive: true })
const logFile = path.join(workDir, `trae-debug-log-${session}.ndjson`)
const envFile = path.join(workDir, `${session}.env`)
fs.writeFileSync(logFile, '')

function pickPort(start) {
  return new Promise((resolve, reject) => {
    let p = start; const max = start + 10
    const tryP = () => {
      const srv = http.createServer()
      srv.on('error', () => { p++; if (p > max) reject(new Error('no port')); else tryP() })
      srv.listen(p, '127.0.0.1', () => { srv.close(() => resolve(p)) })
    }
    tryP()
  })
}

async function main() {
  const port = await pickPort(portArg)
  fs.writeFileSync(envFile, `DEBUG_SERVER_URL=http://127.0.0.1:${port}/event\nDEBUG_SESSION_ID=${session}\n`)
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    if (req.url === '/health') {
      const size = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', session, logBytes: size, uptime: Date.now() - started, port }))
      return
    }
    if (req.url === '/logs') {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
      fs.createReadStream(logFile).pipe(res)
      return
    }
    if (req.method === 'DELETE' && req.url === '/logs') {
      fs.writeFileSync(logFile, ''); res.writeHead(200); res.end('cleared')
      return
    }
    if (req.method === 'POST' && req.url === '/event') {
      let body = ''
      req.on('data', (c) => { body += c.toString() })
      req.on('end', () => {
        try {
          const line = JSON.stringify({ t: Date.now(), ...(body ? JSON.parse(body) : {}) })
          fs.appendFileSync(logFile, line + '\n')
        } catch {}
        res.writeHead(202); res.end('ok')
      })
      return
    }
    res.writeHead(404); res.end('not found')
  })
  const started = Date.now()
  server.listen(port, '127.0.0.1', () => {
    console.log(`[debug-server] session=${session} port=${port} log=${logFile} env=${envFile}`)
  })
}
main()
