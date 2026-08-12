import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const args = process.argv.slice(2)
let sessionId = 'default-session'
let portStart = 7777
let outdir = '.dbg'
let clean = false
let idle = 0
const remote = false
for (let i = 0; i < args.length; i += 1) {
  const a = args[i]
  if (a === '--session') sessionId = String(args[++i] || sessionId)
  else if (a === '--port') portStart = Number(args[++i] || portStart)
  else if (a === '--outdir') outdir = String(args[++i] || outdir)
  else if (a === '--clean') clean = true
  else if (a === '--idle') idle = Number(args[++i] || idle)
  else if (a === '--remote') remote = true
}
if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true })

const logFile = path.resolve(outdir, `trae-debug-log-${sessionId}.ndjson`)
const envFile = path.resolve(outdir, `${sessionId}.env`)
if (clean && fs.existsSync(logFile)) fs.truncateSync(logFile, 0)

function appendLine(file, line) {
  try { fs.appendFileSync(file, line + '\n', { flag: 'a' }) } catch (_) {}
}

let idleTimer = null
function kickIdle() {
  if (!idle) return
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => process.exit(0), idle * 1000)
}

function createServer(port) {
  const server = http.createServer((req, res) => {
    kickIdle()
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      return res.end()
    }
    if (req.method === 'POST' && (req.url === '/event' || req.url === '/event/')) {
      let body = ''
      req.on('data', (chunk) => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const ev = JSON.parse(body || '{}')
          if (!ev.ts) ev.ts = Date.now()
          if (!ev.sessionId) ev.sessionId = sessionId
          appendLine(logFile, JSON.stringify(ev))
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }))
        }
      })
      return
    }
    if (req.method === 'GET' && req.url === '/health') {
      let cnt = 0
      try {
        if (fs.existsSync(logFile)) cnt = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).length
      } catch (_) {}
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      return res.end(JSON.stringify({ ok: true, sessionId, logCount: cnt, uptimeMs: Date.now() - startedAt }))
    }
    if (req.method === 'DELETE' && req.url === '/logs') {
      try { if (fs.existsSync(logFile)) fs.truncateSync(logFile, 0) } catch (_) {}
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      return res.end(JSON.stringify({ ok: true }))
    }
    res.writeHead(404, { 'Access-Control-Allow-Origin': '*' })
    res.end('not found')
  })
  return server.listen(port, remote ? '0.0.0.0' : '127.0.0.1', (err) => {
    if (err) throw err
    startedAt = Date.now()
    const host = remote ? (Object.values(os.networkInterfaces()).flat().find(i => i && !i.internal && i.family === 'IPv4')?.address || '127.0.0.1') : '127.0.0.1'
    const apiUrl = `http://${host}:${port}/event`
    fs.writeFileSync(envFile, `DEBUG_SERVER_URL=${apiUrl}\nDEBUG_SESSION_ID=${sessionId}\n`, 'utf8')
    process.stdout.write(`@@DEBUG_SERVER_INFO\n${JSON.stringify({
      api_url: apiUrl, session_id: sessionId, log_dir: path.resolve(outdir), log_file: logFile, env_file: envFile })}\n@@END_DEBUG_SERVER_INFO\n\n`, () => {})
    kickIdle()
  })
  server.on('error', (err) => {
    if ((err) && String(err?.message || '').includes('EADDRINUSE') && port - portStart < 10) {
      createServer(port + 1)
    } else {
      process.stderr.write('server fatal: ' + String(err?.message || err) + '\n', () => process.exit(1))
    }
  })
}
let startedAt = 0
let cnt = 0
createServer(portStart)
