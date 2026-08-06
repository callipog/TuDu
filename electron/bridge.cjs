/**
 * Ponte HTTP local do TuDu — porta de entrada para agentes de IA (MCP).
 *
 * Desenho e limites:
 *  - Escuta SOMENTE em 127.0.0.1. Nunca em 0.0.0.0.
 *  - Todo request exige `Authorization: Bearer <token>`; o token nasce no
 *    primeiro uso e mora em `userData/bridge.json` (só o usuário lê).
 *  - Requests com cabeçalho `Origin` são recusados: navegador nenhum precisa
 *    falar com a ponte, e isso mata CSRF vindo de uma aba aberta.
 *  - O processo principal NÃO toca no banco. Os dados vivem no IndexedDB do
 *    renderer, então toda operação é repassada por IPC e respondida por lá.
 *  - Escrita nunca é silenciosa: o renderer abre uma revisão para o usuário
 *    confirmar (a menos que ele ligue a aplicação automática nas Configurações).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_PORT = 8787;
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB — roadmap é texto, não precisa de mais
const REQUEST_TIMEOUT_MS = 120000;  // tempo que o agente espera pela confirmação

let server = null;
let state = { running: false, port: null, error: null };
let deps = null; // { userDataPath, getVersion, sendToRenderer, isRendererReady, focusWindow }

const pending = new Map(); // id -> { resolve, timer }

/* ---------------------------------------------------------------- credencial */

function credentialsPath() {
  return path.join(deps.userDataPath, 'bridge.json');
}

/** Lê o token existente ou cria um novo (32 bytes aleatórios). */
function loadOrCreateCredentials(port) {
  const file = credentialsPath();
  let token = null;
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (typeof saved.token === 'string' && saved.token.length >= 32) token = saved.token;
  } catch { /* primeiro uso ou arquivo corrompido: gera de novo */ }

  if (!token) token = crypto.randomBytes(32).toString('hex');

  try {
    fs.writeFileSync(file, JSON.stringify({ port, token }, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } catch (err) {
    console.error('[bridge] não foi possível gravar bridge.json', err);
  }
  return token;
}

/** Comparação em tempo constante — evita vazar o token por tempo de resposta. */
function tokenMatches(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ------------------------------------------------------------ ponte com o app */

/** Envia uma operação ao renderer e espera a resposta (ou a confirmação do usuário). */
function askRenderer(kind, payload) {
  return new Promise((resolve) => {
    if (!deps.isRendererReady()) {
      resolve({ ok: false, status: 503, error: 'O TuDu está iniciando. Tente de novo em instantes.' });
      return;
    }

    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      deps.sendToRenderer('bridge:cancel', { id });
      resolve({ ok: false, status: 408, error: 'Tempo esgotado aguardando confirmação no TuDu.' });
    }, REQUEST_TIMEOUT_MS);

    pending.set(id, { resolve, timer });
    deps.sendToRenderer('bridge:request', { id, kind, payload });

    // Operações de escrita precisam do usuário: traz a janela para frente.
    if (kind !== 'health' && !kind.startsWith('list') && !kind.startsWith('get')) {
      deps.focusWindow();
    }
  });
}

/** Chamado pelo main quando o renderer responde. */
function resolveFromRenderer(message) {
  const entry = pending.get(message?.id);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(message.id);
  entry.resolve(
    message.ok
      ? { ok: true, status: 200, data: message.data }
      : { ok: false, status: message.status || 400, error: String(message.error || 'Operação recusada.') }
  );
}

/* ------------------------------------------------------------------- servidor */

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload grande demais (limite de 1 MB).'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(json);
}

async function handle(req, res, token) {
  // Nenhum cliente legítimo da ponte é um navegador.
  if (req.headers.origin) {
    send(res, 403, { error: 'Requisições de navegador não são aceitas.' });
    return;
  }

  const auth = req.headers.authorization || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!tokenMatches(provided, token)) {
    send(res, 401, { error: 'Token inválido ou ausente.' });
    return;
  }

  const url = new URL(req.url, 'http://127.0.0.1');
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /health') {
    send(res, 200, { app: 'TuDu', version: deps.getVersion(), ready: deps.isRendererReady() });
    return;
  }

  let result;
  if (route === 'GET /projects') {
    result = await askRenderer('listProjects', null);
  } else if (req.method === 'GET' && /^\/projects\/[^/]+$/.test(url.pathname)) {
    result = await askRenderer('getProject', { id: decodeURIComponent(url.pathname.split('/')[2]) });
  } else if (route === 'POST /roadmap' || route === 'POST /tasks') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (err) {
      send(res, 400, { error: err.message || 'JSON inválido.' });
      return;
    }
    result = await askRenderer(route === 'POST /roadmap' ? 'createRoadmap' : 'addTasks', payload);
  } else {
    send(res, 404, { error: 'Rota desconhecida.' });
    return;
  }

  if (result.ok) send(res, 200, result.data);
  else send(res, result.status, { error: result.error });
}

/** Sobe a ponte. Retorna o estado (inclusive erro, se a porta estiver ocupada). */
function start(options) {
  deps = options;
  if (server) return getState();

  const port = Number(options.port) || DEFAULT_PORT;
  const token = loadOrCreateCredentials(port);

  server = http.createServer((req, res) => {
    handle(req, res, token).catch((err) => {
      console.error('[bridge] erro não tratado', err);
      try { send(res, 500, { error: 'Erro interno da ponte.' }); } catch { /* resposta já enviada */ }
    });
  });

  server.on('error', (err) => {
    state = {
      running: false,
      port: null,
      error: err.code === 'EADDRINUSE'
        ? `A porta ${port} já está em uso.`
        : String(err.message || err),
    };
    server = null;
  });

  server.listen(port, '127.0.0.1', () => {
    state = { running: true, port, error: null };
  });

  return getState();
}

function stop() {
  for (const [, entry] of pending) clearTimeout(entry.timer);
  pending.clear();
  if (server) {
    server.close();
    server = null;
  }
  state = { running: false, port: null, error: null };
  return getState();
}

function getState() {
  return { ...state, credentialsPath: deps ? credentialsPath() : null };
}

/** Token atual (para a tela de Configurações mostrar/copiar). */
function getToken() {
  try {
    return JSON.parse(fs.readFileSync(credentialsPath(), 'utf-8')).token || null;
  } catch {
    return null;
  }
}

module.exports = { start, stop, getState, getToken, resolveFromRenderer, DEFAULT_PORT };
