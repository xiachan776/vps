#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const axios = require('axios');
const net = require('net');
const koffi = require('koffi');
const { execSync } = require('child_process');

try { require('dotenv').config(); } catch { /* ignore if dotenv unavailable */ }

// ======================== 环境变量定义 ========================
const UPLOAD_URL     = process.env.UPLOAD_URL     || '';         // 订阅或节点自动上传地址,需填写部署Merge-sub项目后的首页地址
const PROJECT_URL    = process.env.PROJECT_URL    || '';         // 需要上传订阅或保活时需填写项目分配的url
const AUTO_ACCESS    = process.env.AUTO_ACCESS    || false;      // false关闭自动保活，true开 ?需同时填写PROJECT_URL变量
const YT_WARPOUT     = process.env.YT_WARPOUT     || false;      // 设置为true时强制使用warp出站访问youtube
const FILE_PATH      = process.env.FILE_PATH      || '.npm';     // sub.txt订阅文件路径
const SUB_PATH       = process.env.SUB_PATH       || 'sub';      // 订阅sub路径，默认为sub
const UUID           = process.env.UUID           || '0a6568ff-ea3c-4271-9020-450560e10d63'; // UUID，运行哪吒请修改
const NEZHA_SERVER   = process.env.NEZHA_SERVER   || '';         // 哪吒面板地址，v1形式：nz.serv00.net:8008
const NEZHA_PORT     = process.env.NEZHA_PORT     || '';         // v1哪吒请留空，v0 agent端口
const NEZHA_KEY      = process.env.NEZHA_KEY      || '';         // v1的NZ_CLIENT_SECRET或v0 agent密钥
const ARGO_DOMAIN    = process.env.ARGO_DOMAIN    || '';         // argo固定隧道域名,留空即使用临时隧 ?
const ARGO_AUTH      = process.env.ARGO_AUTH      || '';         // argo固定隧道token或json,留空即使用临时隧 ?
const ARGO_PORT   = Number(process.env.ARGO_PORT) || 8001;       // argo固定隧道端口
const S5_PORT        = process.env.S5_PORT        || '';         // socks5端口，留空不启用
const TUIC_PORT      = process.env.TUIC_PORT      || '';         // tuic端口，留空不启用
const HY2_PORT       = process.env.HY2_PORT       || '';         // hy2端口，留空不启用
const ANYTLS_PORT    = process.env.ANYTLS_PORT    || '';         // AnyTLS端口，留空不启用
const REALITY_PORT   = process.env.REALITY_PORT   || '';         // reality端口，留空不启用
const CFIP           = process.env.CFIP           || 'saas.sin.fan'; // 优选域名或优选IP
const CFPORT         = Number(process.env.CFPORT) || 443;        // 优选域名或优选IP对应端口
const PORT           = Number(process.env.PORT)   || 3000;       // http订阅端口
const NAME           = process.env.NAME           || '';         // 节点名称
const CHAT_ID        = process.env.CHAT_ID        || '';         // Telegram chat_id，两个变量不全不推 ?
const BOT_TOKEN      = process.env.BOT_TOKEN      || '';         // Telegram bot_token，两个变量不全不推 ?
const DISABLE_ARGO   = process.env.DISABLE_ARGO   || false;      // 设置为true时禁用argo
const SHOW_LOG       = !['false', 'disable', 'no'].includes((process.env.SHOW_LOG || 'true').toLowerCase()); // 是否显示日志输出，true/yes显示，false/disable/no屏蔽，默认显 ?
// ===== CF-Server-Monitor 探针 (CFSM) =====
// ID/密钥/URL 走环境变量（每台服务器不同）；三网测速节点已直接填好。
// 三者缺任一则整段跳过，对原有节点功能零影响。仍可用同名环境变量覆盖任何一项。
// 口径：官方 cf-probe 读 /proc/meminfo、statfs("/")、btime，在容器里拿到的是【宿主机】数字。
//   本段是内置的 cgroup 口径采集器：内存/CPU/磁盘/开机时长全部取本容器的限额与用量。
const CFSM_ID            = process.env.CFSM_ID            || '';   // 服务器ID（每台机器不同，必填）
const CFSM_SECRET        = process.env.CFSM_SECRET        || '';   // 上报密钥 = 面板 API_SECRET
const CFSM_URL           = process.env.CFSM_URL           || '';   // Worker上报地址(以 /update 结尾)
const CFSM_INTERVAL      = process.env.CFSM_INTERVAL      || '60'; // 上报间隔(秒)
const CFSM_COLLECT_INTERVAL = process.env.CFSM_COLLECT_INTERVAL || '0'; // 高频采样间隔(秒)，0=关
const CFSM_RESET_DAY     = process.env.CFSM_RESET_DAY     || '1';  // 月流量重置日(1-31，0=不重置)
const CFSM_CT_NODE       = process.env.CFSM_CT_NODE       || 'gd-ct-dualstack.ip.zstaticcdn.com';  // 电信测速节点（已填）
const CFSM_CU_NODE       = process.env.CFSM_CU_NODE       || 'gd-cu-dualstack.ip.zstaticcdn.com';  // 联通测速节点（已填）
const CFSM_CM_NODE       = process.env.CFSM_CM_NODE       || 'gd-cm-dualstack.ip.zstaticcdn.com';  // 移动测速节点（已填）
const CFSM_BD_NODE       = process.env.CFSM_BD_NODE       || '';   // BGP测速节点（留空=不测）
const CFSM_AGENT_VERSION = process.env.CFSM_AGENT_VERSION || 'local-1.0.0'; // 面板上可一眼看出是哪个采集器
const CFSM_MEM_TOTAL_MB  = process.env.CFSM_MEM_TOTAL_MB  || '';   // 容器没配额时手填内存总量(MB)，留空=自动
const CFSM_DISK_TOTAL_MB = process.env.CFSM_DISK_TOTAL_MB || '';   // 容器没配额时手填磁盘总量(MB)，留空=自动
const CFSM_DISK_PATH     = process.env.CFSM_DISK_PATH     || '';   // 磁盘用量统计目录，默认脚本所在目录
const CFSM_CPU_MODE      = process.env.CFSM_CPU_MODE      || 'quota'; // quota=相对容器限额 | core=相对单核 | host=相对宿主核数
const CFSM_PING_INTERVAL = process.env.CFSM_PING_INTERVAL || '20';    // 三网探测间隔(秒)
const CFSM_PING_TIMEOUT_MS = process.env.CFSM_PING_TIMEOUT_MS || '1500'; // TCP探测超时(毫秒)
const CFSM_STATE_DIR     = process.env.CFSM_STATE_DIR     || '';   // 状态与日志目录，默认 FILE_PATH/cfsm
// —— 到期时间自动回写（可选，非探针能力；探针协议里没有到期字段，只能写面板的 servers 表）——
const CFSM_EXPIRE_DATE   = process.env.CFSM_EXPIRE_DATE   || '';
const CFSM_EXPIRE_AUTO_RENEWAL = process.env.CFSM_EXPIRE_AUTO_RENEWAL || '1';
const CFSM_EXPIRE_REFRESH_HOURS = process.env.CFSM_EXPIRE_REFRESH_HOURS || '12';
// ==============================================================

// 控制日志输出
function log(...args) {
  if (SHOW_LOG) console.log(...args);
}

const ROOT = process.cwd();
const runtimeFilePath = path.resolve(ROOT, FILE_PATH);
const libraryDir = runtimeFilePath;
const singBoxConfigPath = path.resolve(runtimeFilePath, 'config.json');
const nezhaConfigPath = path.resolve(runtimeFilePath, 'config.yaml');
const bootLogPath = path.resolve(runtimeFilePath, 'boot.log');
const subPath = path.resolve(runtimeFilePath, 'sub.txt');
const listPath = path.resolve(runtimeFilePath, 'list.txt');
const keypairPath = path.resolve(runtimeFilePath, 'keypair.properties');
const subscribePath = '/' + SUB_PATH.replace(/^\//, '');
const httpPort = PORT;

// CFSM 采集器的落盘位置（状态文件 + 日志）
const cfsmDir = path.resolve(runtimeFilePath, 'cfsm');

const arch = (() => {
  const a = os.arch().toLowerCase();
  if (a === 'arm64' || a === 'aarch64') return 'arm64';
  return 'amd64';
})();

let privateKey = '';
let publicKey = '';

// ======================== 辅助函数 ========================

function isValidPort(port) {
  try {
    if (port === null || port === undefined || port === '') return false;
    if (typeof port === 'string' && port.trim() === '') return false;
    const portNum = parseInt(port);
    if (isNaN(portNum)) return false;
    if (portNum < 1 || portNum > 65535) return false;
    return true;
  } catch (error) {
    return false;
  }
}

// ======================== 文件清理 ========================

const pathsToDelete = ['boot.log', 'list.txt', 'config.json', 'config.yaml', 'cert.pem', 'private.key', 'tunnel.json', 'tunnel.yml'];
function cleanupOldFiles() {
  pathsToDelete.forEach(file => {
    const filePath = path.join(FILE_PATH, file);
    fs.unlink(filePath, () => {});
  });
  const tmpDir = path.resolve(ROOT, '.tmp');
  if (fs.existsSync(tmpDir)) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { }
  }
}

function cleanupFiles(options = {}) {
  const keepFiles = new Set(['keypair.properties']);
  if (options.keepSub) keepFiles.add('sub.txt');
  if (fs.existsSync(runtimeFilePath)) {
    try {
      const files = fs.readdirSync(runtimeFilePath);
      for (const file of files) {
        if (keepFiles.has(file)) continue;
        const filePath = path.resolve(runtimeFilePath, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        } catch (e) { /* skip locked/in-use files */ }
      }
    } catch (e) {
      log('Cleanup failed:', e.message);
    }
  }
  const tmpDir = path.resolve(ROOT, '.tmp');
  if (fs.existsSync(tmpDir)) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { }
  }
}

function clearConsole() {
  process.stdout.write('\x1Bc');
}

// ======================== 节点删除 ========================

function deleteNodes() {
  try {
    if (!UPLOAD_URL) return;
    if (!fs.existsSync(subPath)) return;
    let fileContent;
    try { fileContent = fs.readFileSync(subPath, 'utf-8'); } catch { return null; }
    const decoded = Buffer.from(fileContent, 'base64').toString('utf-8');
    const nodes = decoded.split('\n').filter(line =>
      /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line)
    );
    if (nodes.length === 0) return;
    return axios.post(`${UPLOAD_URL}/api/delete-nodes`,
      JSON.stringify({ nodes }),
      { headers: { 'Content-Type': 'application/json' } }
    ).catch(() => null);
  } catch (err) {
    return null;
  }
}

// ======================== Argo 隧道配置 ========================

function argoType() {
  if (DISABLE_ARGO === 'true' || DISABLE_ARGO === true) {
    log("DISABLE_ARGO is set to true, disable argo tunnel");
    return;
  }
  if (!ARGO_AUTH || !ARGO_DOMAIN) {
    log("ARGO_DOMAIN or ARGO_AUTH variable is empty, use quick tunnel");
    return;
  }
  if (ARGO_AUTH.includes('TunnelSecret')) {
    fs.writeFileSync(path.join(FILE_PATH, 'tunnel.json'), ARGO_AUTH);
    const tunnelYaml = `
  tunnel: ${ARGO_AUTH.split('"')[11]}
  credentials-file: ${path.join(FILE_PATH, 'tunnel.json')}
  protocol: http2
  
  ingress:
    - hostname: ${ARGO_DOMAIN}
      service: http://localhost:${ARGO_PORT}
      originRequest:
        noTLSVerify: true
    - service: http_status:404
  `;
    fs.writeFileSync(path.join(FILE_PATH, 'tunnel.yml'), tunnelYaml);
  } else {
    log(`Using token connect to tunnel, please set ${ARGO_PORT} in cloudflare`);
  }
}

// ======================== 下载库文 ?========================

async function sha256Matches(filePath, expected) {
  if (!expected) return true;
  const actual = await sha256(filePath);
  return actual.toLowerCase() === expected.toLowerCase();
}

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function downloadLibrary(url, fileName, expectedSha256) {
  const target = path.resolve(libraryDir, fileName);
  if (fs.existsSync(target) && await sha256Matches(target, expectedSha256)) {
    log(`Using cached native library: ${target}`);
    return target;
  }
  await fs.promises.mkdir(libraryDir, { recursive: true });
  const tmp = path.resolve(libraryDir, `${fileName}.download`);
  const fallbackUrl = url.replace(`${arch}.oooen.com`, `${arch}.ssss.nyc.mn`);
  let lastError;
  for (const candidateUrl of [url, fallbackUrl]) {
    try {
      log(`Downloading -> ${target}`);
      const writer = fs.createWriteStream(tmp);
      const response = await axios.get(candidateUrl, { responseType: 'stream', timeout: 3 * 60 * 1000 });
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Failed to download ${candidateUrl}: HTTP ${response.status}`);
      }
      response.data.pipe(writer);
      await new Promise((resolve, reject) => writer.on('finish', resolve).on('error', reject));
      if (!(await sha256Matches(tmp, expectedSha256))) {
        throw new Error(`SHA-256 mismatch for ${tmp}`);
      }
      await fs.promises.rename(tmp, target);
      return target;
    } catch (error) {
      lastError = error;
      try { await fs.promises.unlink(tmp); } catch { }
      if (candidateUrl === url) {
        log(`Primary download failed, trying fallback: ${error.message}`);
      }
    }
  }
  throw lastError;
}

// ======================== Koffi 服务管理 ========================

function createService(name, libraryPath, startSymbol, stopSymbol, payload) {
  const lib = koffi.load(libraryPath);
  const startFn = lib.func(`int ${startSymbol}(str)`);
  const stopFn = lib.func(`int ${stopSymbol}()`);
  return {
    name,
    start: () => {
      startFn.async(payload || '', (err, code) => {
        if (err) {
          log(`${name} native service failed: ${err.message}`);
        } else if (code !== 0) {
          log(`${name} native service exited with code ${code}`);
        }
      });
    },
    stop: () => new Promise((resolve, reject) => {
      try {
        stopFn.async((err, code) => {
          if (err) return reject(err);
          resolve(code);
        });
      } catch (error) {
        resolve(-1);
      }
    })
  };
}

// ======================== Reality X25519 密钥 ?(纯JS) ========================

const _X25519_P = (1n << 255n) - 19n;
const _X25519_A24 = 121665n;

function _clampScalar(buf) {
  buf[0] &= 248;
  buf[31] &= 127;
  buf[31] |= 64;
}

function _mod(value) {
  value = ((value % _X25519_P) + _X25519_P) % _X25519_P;
  return value;
}

function _decodeLE(buf) {
  let result = 0n;
  for (let i = buf.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(buf[i]);
  }
  return result;
}

function _encodeLE(value) {
  const buf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    buf[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return buf;
}

function _x25519(scalar, u) {
  let x1 = _decodeLE(u);
  let x2 = 1n, z2 = 0n, x3 = x1, z3 = 1n;
  let swap = 0;
  for (let t = 254; t >= 0; t--) {
    const byteIdx = Math.floor(t / 8);
    const kt = ((scalar[byteIdx] & 0xff) >> (t % 8)) & 1;
    swap ^= kt;
    if (swap) { [x2, x3] = [x3, x2]; [z2, z3] = [z3, z2]; }
    swap = kt;
    const a = _mod(x2 + z2);
    const aa = _mod(a * a);
    const b = _mod(x2 - z2 + _X25519_P);
    const bb = _mod(b * b);
    const e = _mod(aa - bb + _X25519_P);
    const c = _mod(x3 + z3);
    const d = _mod(x3 - z3 + _X25519_P);
    const da = _mod(d * a);
    const cb = _mod(c * b);
    x3 = _mod((da + cb) * (da + cb));
    z3 = _mod(x1 * _mod((da - cb + _X25519_P) * (da - cb + _X25519_P)));
    x2 = _mod(aa * bb);
    z2 = _mod(e * _mod(aa + _X25519_A24 * e));
  }
  if (swap) { [x2, x3] = [x3, x2]; [z2, z3] = [z3, z2]; }
  const z2inv = _modPow(z2, _X25519_P - 2n, _X25519_P);
  return _encodeLE(_mod(x2 * z2inv));
}

function _modPow(base, exp, mod) {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

function generateRealityKeyPair() {
  const privateBytes = crypto.randomBytes(32);
  _clampScalar(privateBytes);
  const basepoint = Buffer.alloc(32);
  basepoint[0] = 9;
  const publicBytes = _x25519(privateBytes, basepoint);
  return {
    privateKey: privateBytes.toString('base64url'),
    publicKey: publicBytes.toString('base64url')
  };
}

function generateOrLoadKeyPair() {
  if (fs.existsSync(keypairPath)) {
    const content = fs.readFileSync(keypairPath, 'utf8');
    const privateKeyMatch = content.match(/PrivateKey:\s*(.*)/);
    const publicKeyMatch = content.match(/PublicKey:\s*(.*)/);
    if (privateKeyMatch && publicKeyMatch) {
      privateKey = privateKeyMatch[1];
      publicKey = publicKeyMatch[1];
      log('Private Key:', privateKey);
      log('Public Key:', publicKey);
      return;
    }
  }
  const pair = generateRealityKeyPair();
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;
  fs.writeFileSync(keypairPath, `PrivateKey: ${privateKey}\nPublicKey: ${publicKey}\n`, 'utf8');
  log('Private Key:', privateKey);
  log('Public Key:', publicKey);
}

// ======================== TLS 证书 ========================

const FALLBACK_EC_KEY =
  '-----BEGIN EC PARAMETERS-----\n' +
  'BggqhkjOPQMBBw==\n' +
  '-----END EC PARAMETERS-----\n' +
  '-----BEGIN EC PRIVATE KEY-----\n' +
  'MHcCAQEEIM4792SEtPqIt1ywqTd/0bYidBqpYV/++siNnfBYsdUYoAoGCCqGSM49\n' +
  'AwEHoUQDQgAE1kHafPj07rJG+HboH2ekAI4r+e6TL38GWASANnngZreoQDF16ARa\n' +
  '/TsyLyFoPkhLxSbehH/NBEjHtSZGaDhMqQ==\n' +
  '-----END EC PRIVATE KEY-----\n';

const FALLBACK_CERT =
  '-----BEGIN CERTIFICATE-----\n' +
  'MIIBejCCASGgAwIBAgIUfWeQL3556PNJLp/veCFxGNj9crkwCgYIKoZIzj0EAwIw\n' +
  'EzERMA8GA1UEAwwIYmluZy5jb20wHhcNMjUwOTE4MTgyMDIyWhcNMzUwOTE2MTgy\n' +
  'MDIyWjATMREwDwYDVQQDDAhiaW5nLmNvbTBZMBMGByqGSM49AgEGCCqGSM49AwEH\n' +
  'A0IABNZB2nz49O6yRvh26B9npACOK/nuky9/BlgEgDZ54Ga3qEAxdegEWv07Mi8h\n' +
  'aD5IS8Um3oR/zQRIx7UmRmg4TKmjUzBRMB0GA1UdDgQWBBTV1cFID7UISE7PLTBR\n' +
  'BfGbgkrMNzAfBgNVHSMEGDAWgBTV1cFID7UISE7PLTBRBfGbgkrMNzAPBgNVHRMB\n' +
  'Af8EBTADAQH/MAoGCCqGSM49BAMCA0cAMEQCIAIDAJvg0vd/ytrQVvEcSm6XTlB+\n' +
  'eQ6OFb9LbLYL9f+sAiAffoMbi4y/0YUSlTtz7as9S8/lciBF5VCUoVIKS+vX2g==\n' +
  '-----END CERTIFICATE-----\n';

function ensureTlsCertificates(certPath, keyPath) {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) return;
  fs.mkdirSync(path.dirname(certPath), { recursive: true });
  try {
    execSync('openssl version', { stdio: 'ignore' });
    execSync(`openssl ecparam -genkey -name prime256v1 -out "${keyPath}"`, { stdio: 'ignore' });
    execSync(`openssl req -new -x509 -days 3650 -key "${keyPath}" -out "${certPath}" -subj "/CN=bing.com"`, { stdio: 'ignore' });
    return;
  } catch (e) { /* openssl not available */ }
  fs.writeFileSync(keyPath, FALLBACK_EC_KEY);
  fs.writeFileSync(certPath, FALLBACK_CERT);
}

// ======================== sing-box 配置生成 ========================

function generateSingBoxConfig(certPath, keyPath) {
  const inbounds = [];

  // VMess+WS inbound (for argo reverse proxy)
  inbounds.push({
    type: 'vmess',
    tag: 'vmess-ws-in',
    listen: '::',
    listen_port: ARGO_PORT,
    users: [{ uuid: UUID }],
    transport: {
      type: 'ws',
      path: '/vmess-argo',
      early_data_header_name: 'Sec-WebSocket-Protocol'
    }
  });

  // Reality
  if (isValidPort(REALITY_PORT)) {
    inbounds.push({
      type: 'vless',
      tag: 'vless-reality',
      listen: '::',
      listen_port: parseInt(REALITY_PORT),
      users: [{ uuid: UUID, flow: 'xtls-rprx-vision' }],
      tls: {
        enabled: true,
        server_name: 'www.iij.ad.jp',
        reality: {
          enabled: true,
          handshake: { server: 'www.iij.ad.jp', server_port: 443 },
          private_key: privateKey,
          short_id: ['']
        }
      }
    });
  }

  // Hysteria2
  if (isValidPort(HY2_PORT)) {
    inbounds.push({
      type: 'hysteria2',
      tag: 'hysteria-in',
      listen: '::',
      listen_port: parseInt(HY2_PORT),
      users: [{ password: UUID }],
      masquerade: 'https://bing.com',
      tls: {
        enabled: true,
        alpn: ['h3'],
        certificate_path: certPath,
        key_path: keyPath
      }
    });
  }

  // TUIC
  if (isValidPort(TUIC_PORT)) {
    inbounds.push({
      type: 'tuic',
      tag: 'tuic-in',
      listen: '::',
      listen_port: parseInt(TUIC_PORT),
      users: [{ uuid: UUID, password: UUID }],
      congestion_control: 'bbr',
      tls: {
        enabled: true,
        alpn: ['h3'],
        certificate_path: certPath,
        key_path: keyPath
      }
    });
  }

  // SOCKS5
  if (isValidPort(S5_PORT)) {
    inbounds.push({
      type: 'socks',
      tag: 's5-in',
      listen: '::',
      listen_port: parseInt(S5_PORT),
      users: [{
        username: UUID.substring(0, 8),
        password: UUID.slice(-12)
      }]
    });
  }

  // AnyTLS
  if (isValidPort(ANYTLS_PORT)) {
    inbounds.push({
      type: 'anytls',
      tag: 'anytls-in',
      listen: '::',
      listen_port: parseInt(ANYTLS_PORT),
      users: [{ password: UUID }],
      tls: {
        enabled: true,
        certificate_path: certPath,
        key_path: keyPath
      }
    });
  }

  // Wireguard endpoint + route rules
  const endpoints = [{
    type: 'wireguard',
    tag: 'wireguard-out',
    mtu: 1280,
    address: ['172.16.0.2/32', '2606:4700:110:8dfe:d141:69bb:6b80:925/128'],
    private_key: 'YFYOAdbw1bKTHlNNi+aEjBM3BO7unuFC5rOkMRAz9XY=',
    peers: [{
      address: 'engage.cloudflareclient.com',
      port: 2408,
      public_key: 'bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=',
      allowed_ips: ['0.0.0.0/0', '::/0'],
      reserved: [78, 135, 76]
    }]
  }];

  const remoteRuleSet = (tag, url) => ({
    tag,
    type: 'remote',
    format: 'binary',
    url
  });
  const ruleSet = [
    remoteRuleSet('netflix', 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/netflix.srs'),
    remoteRuleSet('openai', 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/openai.srs')
  ];
  const wireguardRuleSets = ['netflix'];

  // YouTube WARP 出站检 ?
  let needYoutubeWarp = YT_WARPOUT === true || YT_WARPOUT === 'true';
  if (!needYoutubeWarp) {
    try {
      const youtubeTest = execSync('curl -o /dev/null -m 2 -s -w "%{http_code}" https://www.youtube.com', { encoding: 'utf8' }).trim();
      needYoutubeWarp = youtubeTest !== '200';
    } catch (curlError) {
      if (curlError.output && curlError.output[1]) {
        const test = curlError.output[1].toString().trim();
        needYoutubeWarp = test !== '200';
      } else {
        needYoutubeWarp = true;
      }
    }
  }
  if (needYoutubeWarp) {
    ruleSet.push(remoteRuleSet('youtube', 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/youtube.srs'));
    wireguardRuleSets.push('youtube');
    log('Add YouTube outbound rule');
  }

  const route = {
    default_http_client: 'http-client-direct',
    rule_set: ruleSet,
    rules: [{ rule_set: wireguardRuleSets, outbound: 'wireguard-out' }],
    final: 'direct'
  };

  return {
    log: { disabled: true, level: 'error', timestamp: true },
    http_clients: [{ tag: 'http-client-direct' }],
    inbounds,
    endpoints,
    outbounds: [{ type: 'direct', tag: 'direct' }],
    route
  };
}

// ======================== nezha 配置生成 ========================

function generateNezhaConfig() {
  const nzport = NEZHA_SERVER.includes(':') ? NEZHA_SERVER.split(':').pop() : '';
  const tlsPorts = new Set(['443', '8443', '2096', '2087', '2083', '2053']);
  const nezhatls = tlsPorts.has(nzport) ? 'true' : 'false';
  const configYaml = `client_secret: ${NEZHA_KEY}
debug: false
disable_auto_update: true
disable_command_execute: false
disable_force_update: true
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: true
ip_report_period: 1800
report_delay: 4
server: ${NEZHA_SERVER}
skip_connection_count: true
skip_procs_count: true
temperature: false
tls: ${nezhatls}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${UUID}`;
  fs.writeFileSync(nezhaConfigPath, configYaml, 'utf8');
}

// ======================== Cloudflared Payload ========================

function cloudflaredPayload() {
  if (DISABLE_ARGO === 'true' || DISABLE_ARGO === true) return null;
  if (ARGO_AUTH && ARGO_DOMAIN) {
    if (ARGO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) {
      return JSON.stringify({
        args: ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2', 'run', '--token', ARGO_AUTH]
      });
    } else if (ARGO_AUTH.match(/TunnelSecret/)) {
      return JSON.stringify({
        args: ['tunnel', '--edge-ip-version', 'auto', '--config', path.join(FILE_PATH, 'tunnel.yml'), 'run']
      });
    }
  }
  // Quick tunnel
  return JSON.stringify({
    args: [
      'tunnel', '--edge-ip-version', 'auto', '--no-autoupdate',
      '--protocol', 'http2', '--logfile', bootLogPath,
      '--loglevel', 'info', '--url', `http://localhost:${ARGO_PORT}`
    ]
  });
}

function singBoxPayload() {
  return JSON.stringify({ config: singBoxConfigPath, workingDir: '.', disableColor: true });
}

function nezhaPayload() {
  return JSON.stringify({ config: nezhaConfigPath });
}

// ======================== 隧道域名检 ?========================

function waitForQuickTunnelDomain(logPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        const matches = [...content.matchAll(/https:\/\/([A-Za-z0-9.-]+\.trycloudflare\.com)/g)];
        if (matches.length > 0) {
          return matches[matches.length - 1][1];
        }
      }
    } catch (e) { /* file may not exist yet */ }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const sleepMs = Math.min(1000, remaining);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, sleepMs);
  }
  return null;
}

async function extractDomain() {
  if (DISABLE_ARGO === 'true' || DISABLE_ARGO === true) return null;
  if (ARGO_AUTH && ARGO_DOMAIN) {
    log('ARGO_DOMAIN:', ARGO_DOMAIN);
    return ARGO_DOMAIN;
  }
  // Quick tunnel
  log('Waiting for quick tunnel domain in log...');
  let domain = waitForQuickTunnelDomain(bootLogPath, 30000);
  if (!domain) {
    log('Quick tunnel domain not found, retrying...');
    try { fs.unlinkSync(bootLogPath); } catch (e) { }
    await new Promise(r => setTimeout(r, 5000));
    domain = waitForQuickTunnelDomain(bootLogPath, 30000);
  }
  if (domain) {
    log('ArgoDomain:', domain);
  } else {
    log('ArgoDomain not found');
  }
  return domain;
}

// ======================== ISP 信息 ========================

async function getMetaInfo() {
  try {
    const response1 = await axios.get('https://api.ip.sb/geoip', { headers: { 'User-Agent': 'Mozilla/5.0', timeout: 3000 } });
    if (response1.data && response1.data.country_code && response1.data.isp) {
      return `${response1.data.country_code}-${response1.data.isp}`.replace(/\s+/g, '_');
    }
  } catch (error) {
    try {
      const response2 = await axios.get('http://ip-api.com/json', { headers: { 'User-Agent': 'Mozilla/5.0', timeout: 3000 } });
      if (response2.data && response2.data.status === 'success' && response2.data.countryCode && response2.data.org) {
        return `${response2.data.countryCode}-${response2.data.org}`.replace(/\s+/g, '_');
      }
    } catch (error) { /* backup also failed */ }
  }
  return 'Unknown';
}

// ======================== 节点链接生成 ========================

async function generateLinks(argoDomain) {
  let SERVER_IP = '';
  try {
    const ipv4Response = await axios.get('http://ipv4.ip.sb', { timeout: 3000 });
    SERVER_IP = ipv4Response.data.trim();
  } catch (err) {
    try {
      SERVER_IP = execSync('curl -sm 3 ipv4.ip.sb').toString().trim();
    } catch (curlErr) {
      try {
        const ipv6Response = await axios.get('http://ipv6.ip.sb', { timeout: 3000 });
        SERVER_IP = `[${ipv6Response.data.trim()}]`;
      } catch (ipv6AxiosErr) {
        try {
          SERVER_IP = `[${execSync('curl -sm 3 ipv6.ip.sb').toString().trim()}]`;
        } catch (ipv6CurlErr) {
          log('Failed to get IP address:', ipv6CurlErr.message);
        }
      }
    }
  }

  const ISP = await getMetaInfo();
  const nodeName = NAME ? `${NAME}-${ISP}` : ISP;

  await new Promise(r => setTimeout(r, 2000));

  let subTxt = '';

  // VMess+WS (argo)
  if ((DISABLE_ARGO !== 'true' && DISABLE_ARGO !== true) && argoDomain) {
    const vmessNode = `vmess://${Buffer.from(JSON.stringify({ v: '2', ps: `${nodeName}`, add: CFIP, port: CFPORT, id: UUID, aid: '0', scy: 'auto', net: 'ws', type: 'none', host: argoDomain, path: '/vmess-argo?ed=2560', tls: 'tls', sni: argoDomain, alpn: '', fp: 'firefox' })).toString('base64')}`;
    subTxt = vmessNode;
  }

  // TUIC
  if (isValidPort(TUIC_PORT)) {
    subTxt += `\ntuic://${UUID}:${UUID}@${SERVER_IP}:${TUIC_PORT}?sni=www.bing.com&congestion_control=bbr&udp_relay_mode=native&alpn=h3&allow_insecure=1#${nodeName}`;
  }

  // Hysteria2
  if (isValidPort(HY2_PORT)) {
    subTxt += `\nhysteria2://${UUID}@${SERVER_IP}:${HY2_PORT}/?sni=www.bing.com&insecure=1&alpn=h3&obfs=none#${nodeName}`;
  }

  // Reality
  if (isValidPort(REALITY_PORT)) {
    subTxt += `\nvless://${UUID}@${SERVER_IP}:${REALITY_PORT}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=www.iij.ad.jp&fp=firefox&pbk=${publicKey}&type=tcp&headerType=none#${nodeName}`;
  }

  // AnyTLS
  if (isValidPort(ANYTLS_PORT)) {
    subTxt += `\nanytls://${UUID}@${SERVER_IP}:${ANYTLS_PORT}?security=tls&sni=${SERVER_IP}&fp=chrome&insecure=1&allowInsecure=1#${nodeName}`;
  }

  // SOCKS5
  if (isValidPort(S5_PORT)) {
    const S5_AUTH = Buffer.from(`${UUID.substring(0, 8)}:${UUID.slice(-12)}`).toString('base64');
    subTxt += `\nsocks://${S5_AUTH}@${SERVER_IP}:${S5_PORT}#${nodeName}`;
  }

  // 打印绿色 base64 编码
  log('\x1b[32m' + Buffer.from(subTxt).toString('base64') + '\x1b[0m');
  log('\x1b[35m' + 'Logs will be deleted in 45 seconds, you can copy the above nodes' + '\x1b[0m');

  fs.writeFileSync(subPath, Buffer.from(subTxt).toString('base64'));
  fs.writeFileSync(listPath, subTxt, 'utf8');
  log(`${FILE_PATH}/sub.txt saved successfully`);

  return subTxt;
}

// ======================== Telegram 推 ?========================

async function sendTelegram() {
  if (!BOT_TOKEN || !CHAT_ID) {
    log('TG variables is empty, Skipping push nodes to TG');
    return;
  }
  try {
    const message = fs.readFileSync(subPath, 'utf8');
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const escapedName = NAME.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
    const params = {
      chat_id: CHAT_ID,
      text: `**${escapedName}节点推送通知**\n\`\`\`${message}\`\`\``,
      parse_mode: 'MarkdownV2'
    };
    await axios.post(url, null, { params });
    log('Telegram message sent successfully');
  } catch (error) {
    log('Failed to send Telegram message', error);
  }
}

// ======================== 节点上传 ========================

async function uploadNodes() {
  if (UPLOAD_URL && PROJECT_URL) {
    const subscriptionUrl = `${PROJECT_URL}/${SUB_PATH}`;
    const jsonData = { subscription: [subscriptionUrl] };
    try {
      const response = await axios.post(`${UPLOAD_URL}/api/add-subscriptions`, jsonData, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.status === 200) log('Subscription uploaded successfully');
    } catch (error) { /* ignore */ }
  } else if (UPLOAD_URL) {
    if (!fs.existsSync(listPath)) return;
    const content = fs.readFileSync(listPath, 'utf-8');
    const nodes = content.split('\n').filter(line => /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line));
    if (nodes.length === 0) return;
    try {
      const response = await axios.post(`${UPLOAD_URL}/api/add-nodes`,
        JSON.stringify({ nodes }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (response.status === 200) log('Subscription uploaded successfully');
    } catch (error) { /* ignore */ }
  }
}

// ======================== 自动保活 ========================

async function addVisitTask() {
  if (!AUTO_ACCESS || !PROJECT_URL) {
    log('Skipping adding automatic access task');
    return;
  }
  try {
    await axios.post('https://keep.gvrander.eu.org/add-url', {
      url: PROJECT_URL
    }, { headers: { 'Content-Type': 'application/json' } });
    log('Automatic access task added successfully');
  } catch (error) {
    log(`Add URL failed: ${error.message}`);
  }
}

// ======================== HTTP 服务 ?========================

function startHttpServer(subTxt) {
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }
    const url = new URL(req.url, `http://localhost`);
    if (url.pathname === subscribePath) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      const encodedContent = Buffer.from(subTxt).toString('base64');
      res.end(encodedContent);
    } else if (url.pathname === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`Hello world!<br><br>You can access /${SUB_PATH}(Default: /sub) get your nodes!`);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  function tryListen(port, retries) {
    server.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port ${port}`);
    });
    server.once('error', err => {
      if (err.code === 'EADDRINUSE' && retries > 0) {
        log(`Port ${port} in use, trying ${port + 1}...`);
        tryListen(port + 1, retries - 1);
      } else {
        log('HTTP server error:', err.message);
      }
    });
  }

  tryListen(httpPort, 5);
}

// ============================================================================
// 容器口径本地探针（CFSM_ID / CFSM_SECRET / CFSM_URL 三项填齐即启用）
// ----------------------------------------------------------------------------
// 为什么需要它：官方 cf-probe 读 /proc/meminfo、/proc/stat、statfs("/")、btime，在容器里拿到
// 的是【宿主机】的全局值（内存 62.8G、硬盘 775G、CPU 10 核…）—— 它没有 cgroup 逻辑。
// 而面板是「上报什么就显示什么」：服务端 src/utils/metrics.js 的 mergeMetricsIntoServer()
// 会把 ram_total/ram_used/cpu/disk_total/disk_used/cpu_cores/boot_time 原样合并进服务器对象
// （缺字段写成 0），所以只要换一个从 cgroup 采集的 agent，面板上显示的就是本容器的真实用量。
//
// 上报协议（面板 src/handlers/update.js，公开端口，无需 WebSocket）：
//   POST <CFSM_URL>   Content-Type: application/json
//   body: { id, secret, time, metrics:{...}, collect_interval, report_interval }
//   顶层 id/secret 与服务端 env.API_SECRET 明文比对；metrics 键名必须与
//   mergeMetricsIntoServer 一致，且必须发【全量】—— 没发的字段会被面板写成 0。
//
// 口径对照（cf-probe → 本采集器）
//   内存总量/用量   /proc/meminfo 全局   → cgroup memory.max / memory.current - inactive_file
//   内存交换        宿主 swap            → cgroup memory.swap.*
//   CPU 使用率      /proc/stat 全局差分  → cgroup cpu.stat usage_usec 差分 ÷ 容器限额
//   磁盘总量/用量   statfs("/") 宿主     → SERVER_DISK(MB) 限额 / 容器目录实际占用
//   开机时长        btime 宿主开机       → /proc/1/stat starttime（= 容器启动时刻）
//   进程/连接数     (本来就是容器视角)    → 保持不变
//   网络/流量/速率  (本来就是容器视角)    → 保持不变
//   三网延迟/丢包   窗口内中位数(被抹平)  → 最近一次真实 RTT + 失败率（曲线会动）
// ============================================================================
const cfsmStateDir = CFSM_STATE_DIR || cfsmDir;
const cfsmLocalLog = path.join(cfsmStateDir, 'cfsm-local.log');
const cfsmLocalState = path.join(cfsmStateDir, 'cfsm-local-state.json');
const CFSM_PING_WINDOW = 6;              // 丢包率统计窗口（与 cf-probe 的 1/6 分辨率对齐）
const CFSM_DISK_CACHE_MS = 300000;       // 磁盘目录用量缓存 5 分钟（全盘遍历较慢）
const CFSM_DISK_SCAN_BUDGET_MS = 8000;   // 单次遍历时间上限
const CFSM_IFACE_EXCLUDE = /^(lo|br|cni|docker|podman|flannel|veth|virbr|vmbr|tap|fwbr|fwpr|tailscale|tun|wg|wireguard|ipsec|gre|gretap|ipip|sit|ip6tnl|zerotier)/;

const cfsmLoop = {
  cpu: null,
  netAt: 0,
  state: {},
  ping: { ct: null, cu: null, cm: null, bd: null },
  coresHist: [],
  diskCache: null,
  okCount: 0,
  firstReport: true,
  lastConfigAt: 0,
  timers: []
};

function cfsmLogLine(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\n';
  try {
    fs.mkdirSync(cfsmStateDir, { recursive: true });
    fs.appendFileSync(cfsmLocalLog, line);
    if (fs.statSync(cfsmLocalLog).size > 512 * 1024) {
      const keep = fs.readFileSync(cfsmLocalLog, 'utf8').split('\n').slice(-400).join('\n');
      fs.writeFileSync(cfsmLocalLog, keep);
    }
  } catch (e) { /* 日志写失败不影响上报 */ }
  console.log('[cfsm-local] ' + msg);
}

function cfsmRead(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; }
}

function cfsmReadNum(p) {
  const t = cfsmRead(p).trim();
  if (!t || t === 'max') return -1;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : -1;
}

function cfsmCgroupV() {
  if (fs.existsSync('/sys/fs/cgroup/memory.max')) return 2;
  if (fs.existsSync('/sys/fs/cgroup/memory/memory.limit_in_bytes')) return 1;
  return 0;
}

function cfsmEnvNum(name) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function cfsmProcMeminfo() {
  const txt = cfsmRead('/proc/meminfo');
  const get = (k) => {
    const m = txt.match(new RegExp('^' + k + ':\\s+(\\d+)\\s*kB', 'm'));
    return m ? Number(m[1]) / 1024 : 0;
  };
  const total = get('MemTotal');
  let available = get('MemAvailable');
  if (!available) available = get('MemFree') + get('Buffers') + get('Cached');
  return { total: total, available: available };
}

// 内存：优先 cgroup（容器限额），其次平台注入的 SERVER_MEMORY，最后才退回宿主 /proc
function cfsmMemory() {
  const v = cfsmCgroupV();
  let total = 0, used = 0, swapTotal = 0, swapUsed = 0, source = 'proc';

  if (v === 2) {
    const b = '/sys/fs/cgroup';
    const cur = cfsmReadNum(b + '/memory.current');
    const max = cfsmReadNum(b + '/memory.max');
    const stat = cfsmRead(b + '/memory.stat');
    let inactive = 0;
    let m = stat.match(/^inactive_file\s+(\d+)/m);
    if (!m) m = stat.match(/^total_inactive_file\s+(\d+)/m);
    if (m) inactive = Number(m[1]);
    if (cur >= 0) {
      used = Math.max(0, cur - inactive) / 1048576;
      source = 'cgroup2';
    }
    if (max > 0) total = max / 1048576;
    const sc = cfsmReadNum(b + '/memory.swap.current');
    const sm = cfsmReadNum(b + '/memory.swap.max');
    if (sc >= 0) swapUsed = sc / 1048576;
    if (sm > 0) swapTotal = sm / 1048576;
  } else if (v === 1) {
    const b = '/sys/fs/cgroup/memory';
    const cur = cfsmReadNum(b + '/memory.usage_in_bytes');
    const max = cfsmReadNum(b + '/memory.limit_in_bytes');
    const m = cfsmRead(b + '/memory.stat').match(/^total_inactive_file\s+(\d+)/m);
    const inactive = m ? Number(m[1]) : 0;
    if (cur >= 0) {
      used = Math.max(0, cur - inactive) / 1048576;
      source = 'cgroup1';
    }
    const hostTotal = cfsmProcMeminfo().total;
    // cgroup v1 的 limit 常被写成天文数字(等于不限)，超过宿主总量就视为未设置
    if (max > 0 && (!hostTotal || max / 1048576 < hostTotal)) total = max / 1048576;
  }

  const envTotal = Number(CFSM_MEM_TOTAL_MB) || cfsmEnvNum('SERVER_MEMORY');
  if (!total && envTotal > 0) {
    total = envTotal;
    source += '+env';
  }
  if (!used) {
    const info = cfsmProcMeminfo();
    used = Math.max(0, info.total - info.available);
    if (!total) total = info.total;
    source = 'proc(host)';
  }
  if (!total) total = used;
  return { total: total, used: used, swapTotal: swapTotal, swapUsed: swapUsed, source: source };
}

// CPU 限额（核数）：cgroup quota → 平台注入的 SERVER_CPU(100=1核)
function cfsmCpuQuota() {
  const v = cfsmCgroupV();
  let cores = 0;
  if (v === 2) {
    const raw = cfsmRead('/sys/fs/cgroup/cpu.max').trim();
    if (raw) {
      const p = raw.split(/\s+/);
      if (p[0] !== 'max') {
        const q = Number(p[0]), per = Number(p[1] || 100000);
        if (q > 0 && per > 0) cores = q / per;
      }
    }
  } else if (v === 1) {
    const q = cfsmReadNum('/sys/fs/cgroup/cpu/cpu.cfs_quota_us');
    const per = cfsmReadNum('/sys/fs/cgroup/cpu/cpu.cfs_period_us');
    if (q > 0 && per > 0) cores = q / per;
  }
  if (!cores) {
    const pct = cfsmEnvNum('SERVER_CPU');
    if (pct > 0) cores = pct / 100;
  }
  return cores;
}

function cfsmCpuUsageUsec() {
  const v = cfsmCgroupV();
  if (v === 2) {
    const m = cfsmRead('/sys/fs/cgroup/cpu.stat').match(/^usage_usec\s+(\d+)/m);
    return m ? Number(m[1]) : -1;
  }
  if (v === 1) {
    const ns = cfsmReadNum('/sys/fs/cgroup/cpuacct/cpuacct.usage');
    return ns >= 0 ? ns / 1000 : -1;
  }
  return -1;
}

function cfsmCpuPercent() {
  const usage = cfsmCpuUsageUsec();
  const now = Date.now();
  const quota = cfsmCpuQuota();
  const hostCores = (os.cpus() || []).length || 1;
  let coresUsed = 0, fine = false;

  if (usage >= 0 && cfsmLoop.cpu && usage >= cfsmLoop.cpu.usage) {
    const dU = usage - cfsmLoop.cpu.usage;
    const dW = (now - cfsmLoop.cpu.at) * 1000;
    if (dW > 0) { coresUsed = dU / dW; fine = true; }
  }
  if (usage >= 0) cfsmLoop.cpu = { usage: usage, at: now };

  // quota=相对容器限额(默认，100% 即用满配额) | core=相对单核(Pterodactyl 面板口径) | host=相对宿主核数
  const base = CFSM_CPU_MODE === 'host' ? hostCores : (CFSM_CPU_MODE === 'core' ? 1 : (quota > 0 ? quota : hostCores));
  let pct = fine ? (coresUsed / base) * 100 : 0;
  if (!Number.isFinite(pct) || pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return { pct: pct, coresUsed: coresUsed, quota: quota, hostCores: hostCores };
}

// 容器视角的“负载”：用 cgroup 实际占用核数做 1/5/20 次采样的滑动平均（loadavg 不是命名空间隔离的）
function cfsmLoadAvg(coresUsed) {
  const h = cfsmLoop.coresHist;
  h.push(coresUsed);
  if (h.length > 20) h.shift();
  const avg = (k) => {
    const s = h.slice(Math.max(0, h.length - k));
    return s.reduce((a, b) => a + b, 0) / s.length;
  };
  return avg(1).toFixed(2) + ' ' + avg(5).toFixed(2) + ' ' + avg(20).toFixed(2);
}

function cfsmDirSizeMB(dir, deadlineMs) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    if (Date.now() > deadlineMs) break;
    const cur = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch (e) { continue; }
    for (const ent of entries) {
      try {
        if (ent.isDirectory()) stack.push(path.join(cur, ent.name));
        else if (ent.isFile()) total += fs.statSync(path.join(cur, ent.name)).size;
      } catch (e) { /* 权限不足或文件已消失，跳过 */ }
    }
  }
  return total / 1048576;
}

// 磁盘：总量优先平台限额(SERVER_DISK, 单位 MiB)，用量统计容器自己的目录
function cfsmDisk() {
  const root = CFSM_DISK_PATH || __dirname || process.cwd();
  const now = Date.now();
  let used = 0;
  if (cfsmLoop.diskCache && (now - cfsmLoop.diskCache.at) < CFSM_DISK_CACHE_MS) {
    used = cfsmLoop.diskCache.used;
  } else {
    used = cfsmDirSizeMB(root, now + CFSM_DISK_SCAN_BUDGET_MS);
    cfsmLoop.diskCache = { at: now, used: used };
  }

  let total = Number(CFSM_DISK_TOTAL_MB) || cfsmEnvNum('SERVER_DISK');
  let source = total > 0 ? 'env' : '';
  if (!total) {
    try {
      const st = fs.statfsSync(root);
      total = (st.blocks * st.bsize) / 1048576;
      source = 'statfs(host)';
    } catch (e) {
      total = used;
      source = 'used-only';
    }
  }
  if (used > total) used = total;
  return { total: total, used: used, source: source, path: root };
}

// 容器启动时刻：/proc/1/stat 的第 22 字段(starttime, 单位 jiffies) + /proc/stat 的 btime
function cfsmContainerStartMs() {
  const m = cfsmRead('/proc/stat').match(/^btime\s+(\d+)/m);
  const btime = m ? Number(m[1]) * 1000 : 0;
  if (!btime) return 0;
  const stat = cfsmRead('/proc/1/stat');
  const rp = stat.lastIndexOf(')');
  if (rp < 0) return 0;
  const fields = stat.slice(rp + 2).trim().split(/\s+/);
  const ticks = Number(fields[19]);
  if (!Number.isFinite(ticks) || ticks <= 0) return 0;
  return Math.round(btime + (ticks / 100) * 1000);
}

function cfsmNetCounters() {
  const txt = cfsmRead('/proc/net/dev');
  let rx = 0, tx = 0;
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_.@-]+):\s*(.+)$/);
    if (!m || CFSM_IFACE_EXCLUDE.test(m[1])) continue;
    const f = m[2].trim().split(/\s+/);
    rx += Number(f[0]) || 0;
    tx += Number(f[8]) || 0;
  }
  return { rx: rx, tx: tx };
}

function cfsmCycleKey(d) {
  const resetDay = Number(CFSM_RESET_DAY) || 0;
  if (!resetDay || d.getDate() >= resetDay) return d.getFullYear() + '-' + (d.getMonth() + 1);
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return prev.getFullYear() + '-' + (prev.getMonth() + 1);
}

// 月流量：增量累加并落盘（容器重启后计数器归零也不会把月流量清零）
function cfsmTraffic(now) {
  const st = cfsmLoop.state;
  const key = cfsmCycleKey(new Date());
  if (st.cycleKey !== key) {
    st.cycleKey = key;
    st.rxMonth = 0;
    st.txMonth = 0;
    st.lastRx = null;
    st.lastTx = null;
  }
  let dRx = 0, dTx = 0;
  if (typeof st.lastRx === 'number' && typeof st.lastTx === 'number') {
    dRx = now.rx >= st.lastRx ? now.rx - st.lastRx : now.rx;
    dTx = now.tx >= st.lastTx ? now.tx - st.lastTx : now.tx;
  }
  st.rxMonth = (st.rxMonth || 0) + dRx;
  st.txMonth = (st.txMonth || 0) + dTx;

  let speedIn = 0, speedOut = 0;
  if (cfsmLoop.netAt) {
    const dt = (Date.now() - cfsmLoop.netAt) / 1000;
    if (dt > 0) { speedIn = dRx / dt; speedOut = dTx / dt; }
  }
  st.lastRx = now.rx;
  st.lastTx = now.tx;
  cfsmLoop.netAt = Date.now();

  return { rx: now.rx, tx: now.tx, rxMonth: st.rxMonth || 0, txMonth: st.txMonth || 0, speedIn: speedIn, speedOut: speedOut };
}

function cfsmLoadState() {
  try { return JSON.parse(fs.readFileSync(cfsmLocalState, 'utf8')) || {}; } catch (e) { return {}; }
}

function cfsmSaveState() {
  try {
    fs.mkdirSync(cfsmStateDir, { recursive: true });
    fs.writeFileSync(cfsmLocalState, JSON.stringify(cfsmLoop.state));
  } catch (e) { /* 只读目录时放弃持久化，月流量仅在本次运行内有效 */ }
}

function cfsmCountLines(p) {
  const t = cfsmRead(p);
  if (!t.trim()) return 0;
  return Math.max(0, t.trim().split('\n').length - 1);
}

function cfsmCountProcesses() {
  try { return fs.readdirSync('/proc').filter((n) => /^\d+$/.test(n)).length; } catch (e) { return 0; }
}

function cfsmOsName() {
  const m = cfsmRead('/etc/os-release').match(/^PRETTY_NAME="?([^"\n]+)"?/m);
  return m ? m[1] : (os.type() + ' ' + os.release());
}

function cfsmArch() {
  if (process.arch === 'x64') return 'amd64';
  if (process.arch === 'ia32') return '386';
  return process.arch;
}

// 公网 IP：面板直接把该字段原样存成字符串并显示（服务端 server.ip_v4 = metrics.ip_v4 || '0'），
// 所以必须上报**真实地址**，不能只报可达标记 —— 报 '1' 会让前台那一栏空掉。
// 结果缓存 30 分钟：上报间隔 60 秒，不缓存会频繁打爆外部查询接口。
// 查不到时返回 '0'（与服务端「0 表示不可达」的约定一致）。
const CFSM_IP_CACHE_MS = 1800000;
const cfsmIpCache = { at: 0, v4: '0', v6: '0' };

async function cfsmFetchIp(url, timeoutMs) {
  try {
    const res = await axios.get(url, {
      timeout: timeoutMs,
      responseType: 'text',
      transformResponse: [(d) => d],
      headers: { 'User-Agent': 'curl/8.0' }
    });
    if (res.status >= 200 && res.status < 300) {
      const t = String(res.data || '').trim().split(/\s+/)[0];
      return t || '';
    }
  } catch (e) { /* 换下一个源 */ }
  return '';
}

async function cfsmPublicIps() {
  const now = Date.now();
  if (cfsmIpCache.at && (now - cfsmIpCache.at) < CFSM_IP_CACHE_MS) {
    return { v4: cfsmIpCache.v4, v6: cfsmIpCache.v6 };
  }
  let v4 = '';
  for (const url of ['http://ipv4.ip.sb', 'http://v4.ident.me', 'http://4.ipw.cn']) {
    v4 = await cfsmFetchIp(url, 4000);
    if (v4 && /^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) break;
    v4 = '';
  }
  let v6 = '';
  for (const url of ['http://ipv6.ip.sb', 'http://v6.ident.me', 'http://6.ipw.cn']) {
    v6 = await cfsmFetchIp(url, 4000);
    if (v6 && v6.includes(':')) break;
    v6 = '';
  }
  cfsmIpCache.at = now;
  cfsmIpCache.v4 = v4 || '0';
  cfsmIpCache.v6 = v6 ? '[' + v6 + ']' : '0';
  return { v4: cfsmIpCache.v4, v6: cfsmIpCache.v6 };
}

// ---- 三网/自选节点延迟：TCP 握手时延，直接上报最近一次真实值（不再做窗口内中位数）----
function cfsmParseNode(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/^(?:tcp:\/\/)?(?:\[([^\]]+)\]|([^:\/]+))(?::(\d+))?/);
  if (!m) return null;
  const host = m[1] || m[2];
  const port = Number(m[3] || 80);
  return host ? { host: host, port: port } : null;
}

function cfsmTcpProbe(node) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let done = false;
    const sock = new net.Socket();
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch (e) { }
      resolve({ ok: ok, rtt: ok ? Math.max(1, Date.now() - t0) : -1 });
    };
    sock.setTimeout(Number(CFSM_PING_TIMEOUT_MS) || 1500);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    try { sock.connect(node.port, node.host); } catch (e) { finish(false); }
  });
}

async function cfsmPingTick() {
  const nodes = {
    ct: cfsmParseNode(CFSM_CT_NODE),
    cu: cfsmParseNode(CFSM_CU_NODE),
    cm: cfsmParseNode(CFSM_CM_NODE),
    bd: cfsmParseNode(CFSM_BD_NODE)
  };
  const jobs = [];
  for (const k of ['ct', 'cu', 'cm', 'bd']) {
    if (!nodes[k]) continue;
    jobs.push(cfsmTcpProbe(nodes[k]).then((r) => {
      const w = cfsmLoop.ping[k] || [];
      w.push(r);
      while (w.length > CFSM_PING_WINDOW) w.shift();
      cfsmLoop.ping[k] = w;
    }));
  }
  if (jobs.length) await Promise.all(jobs);
}

function cfsmPingResult(k) {
  const w = cfsmLoop.ping[k];
  if (!w || !w.length) return { ping: null, loss: null };
  const okList = w.filter((x) => x.ok);
  const ok = okList.length;
  return {
    ping: ok ? okList[okList.length - 1].rtt : null,
    loss: Math.round(((w.length - ok) * 100) / w.length)
  };
}

async function cfsmBuildMetrics() {
  const mem = cfsmMemory();
  const cpu = cfsmCpuPercent();
  const disk = cfsmDisk();
  const traffic = cfsmTraffic(cfsmNetCounters());
  const ips = await cfsmPublicIps();
  const ct = cfsmPingResult('ct'), cu = cfsmPingResult('cu'), cm = cfsmPingResult('cm'), bd = cfsmPingResult('bd');
  const cores = cpu.quota > 0 ? cpu.quota : cpu.hostCores;
  const model = ((os.cpus() || [])[0] || {}).model || '';
  const note = cpu.quota > 0 ? ' | cgroup limit ' + cpu.quota.toFixed(2) + ' core' : '';
  const startMs = cfsmContainerStartMs();

  return {
    cpu: cpu.pct.toFixed(2),
    ram_total: Math.round(mem.total),
    ram_used: Math.round(mem.used),
    swap_total: Math.round(mem.swapTotal),
    swap_used: Math.round(mem.swapUsed),
    disk_total: Math.round(disk.total),
    disk_used: Math.round(disk.used),
    load_avg: cfsmLoadAvg(cpu.coresUsed),
    boot_time: startMs || Date.now(),
    net_rx: traffic.rx,
    net_tx: traffic.tx,
    net_rx_monthly: Math.round(traffic.rxMonth),
    net_tx_monthly: Math.round(traffic.txMonth),
    net_in_speed: Math.round(traffic.speedIn),
    net_out_speed: Math.round(traffic.speedOut),
    os: cfsmOsName(),
    arch: cfsmArch(),
    kernel_version: os.release(),
    cpu_info: (model + note).trim(),
    cpu_cores: cpu.quota > 0 ? cpu.quota : cpu.hostCores,
    gpu_info: null,
    processes: cfsmCountProcesses(),
    tcp_conn: cfsmCountLines('/proc/net/tcp') + cfsmCountLines('/proc/net/tcp6'),
    udp_conn: cfsmCountLines('/proc/net/udp') + cfsmCountLines('/proc/net/udp6'),
    ip_v4: ips.v4,
    ip_v6: ips.v6,
    ping_ct: ct.ping, ping_cu: cu.ping, ping_cm: cm.ping, ping_bd: bd.ping,
    loss_ct: ct.loss, loss_cu: cu.loss, loss_cm: cm.loss, loss_bd: bd.loss,
    agent_version: CFSM_AGENT_VERSION
  };
}

function cfsmReportInterval() {
  const n = Number(CFSM_INTERVAL);
  return Number.isFinite(n) && n >= 10 ? Math.round(n) : 60;
}

async function cfsmReport() {
  const metrics = await cfsmBuildMetrics();
  const body = {
    id: CFSM_ID,
    secret: CFSM_SECRET,
    time: Date.now(),
    metrics: metrics,
    collect_interval: Number(CFSM_COLLECT_INTERVAL) || 0,
    report_interval: cfsmReportInterval()
  };
  const now = Date.now();
  if (cfsmLoop.firstReport || (now - cfsmLoop.lastConfigAt) > 1800000) {
    body.config_schema = '7';
    body.config_md5 = 'none';
    cfsmLoop.lastConfigAt = now;
  }
  cfsmLoop.firstReport = false;

  try {
    const res = await axios.post(CFSM_URL, body, {
      timeout: 15000,
      validateStatus: () => true,
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': 'cfsm',
        'X-Agent-Version': CFSM_AGENT_VERSION,
        'X-Agent-Config-Schema': '7',
        'X-Agent-Config-Md5': 'none'
      }
    });
    if (res.status >= 200 && res.status < 300) {
      cfsmLoop.okCount++;
      if (cfsmLoop.okCount % 10 === 1) {
        cfsmLogLine('report ok cpu=' + metrics.cpu + '% mem=' + metrics.ram_used + '/' + metrics.ram_total
          + 'MB disk=' + metrics.disk_used + '/' + metrics.disk_total + 'MB ups=' + metrics.boot_time
          + ' net=' + metrics.net_rx_monthly + 'B ping=' + metrics.ping_ct + '/' + metrics.ping_cu + '/' + metrics.ping_cm
          + ' loss=' + metrics.loss_ct + '/' + metrics.loss_cu + '/' + metrics.loss_cm);
      }
    } else {
      cfsmLogLine('report failed http=' + res.status + ' body=' + String(JSON.stringify(res.data)).slice(0, 200));
    }
  } catch (e) {
    cfsmLogLine('report error: ' + e.message);
  }
  cfsmSaveState();
}

// ---- 到期时间回写（可选；探针协议本身没有到期字段，只能写面板的 servers 表）----
function cfsmLocalDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

async function cfsmResolveExpireDate() {
  if (/^\d{4}-\d{2}-\d{2}$/.test(CFSM_EXPIRE_DATE)) {
    return { date: CFSM_EXPIRE_DATE, from: 'CFSM_EXPIRE_DATE' };
  }
  const key = process.env.HOSTSHIP_API_KEY || '';
  const sid = process.env.HOSTSHIP_SERVER_ID || '';
  const base = String(process.env.HOSTSHIP_PANEL || '').replace(/\/+$/, '');
  if (!key || !sid || !base) return null;
  const res = await axios.get(base + '/api/client/servers/' + sid, {
    headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
    timeout: 20000,
    validateStatus: () => true
  });
  if (res.status !== 200) {
    cfsmLogLine('expire sync: 平台 API 返回 http=' + res.status);
    return null;
  }
  const days = Number(((res.data || {}).attributes || {}).renewal);
  if (!Number.isFinite(days)) {
    cfsmLogLine('expire sync: 平台 API 未返回 renewal 字段');
    return null;
  }
  return { date: cfsmLocalDate(new Date(Date.now() + days * 86400000)), from: base + ' renewal=' + days + 'd' };
}

async function cfsmExpireSync() {
  const r = await cfsmResolveExpireDate();
  if (!r) return;
  const url = 'https://api.cloudflare.com/client/v4/accounts/' + process.env.CF_ACCOUNT_ID
    + '/d1/database/' + process.env.CF_D1_DATABASE_ID + '/query';
  const res = await axios.post(url, {
    sql: "UPDATE servers SET expire_date = ?, billing_cycle = 'month', auto_renewal = ?, currency = COALESCE(NULLIF(currency, ''), '¥') WHERE id = ?",
    params: [r.date, String(CFSM_EXPIRE_AUTO_RENEWAL || '1'), CFSM_ID]
  }, {
    headers: { Authorization: 'Bearer ' + process.env.CF_API_TOKEN, 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true
  });
  const ok = res.data && res.data.success;
  cfsmLogLine('expire sync: ' + (ok
    ? '已写入 expire_date=' + r.date + '（来源 ' + r.from + '）'
    : '失败 http=' + res.status + ' ' + String(JSON.stringify(res.data)).slice(0, 200)));
}

function cfsmScheduleExpireSync() {
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(CFSM_EXPIRE_DATE);
  const hasProvider = !!(process.env.HOSTSHIP_API_KEY && process.env.HOSTSHIP_SERVER_ID && process.env.HOSTSHIP_PANEL);
  if (!hasDate && !hasProvider) return;
  if (!(process.env.CF_API_TOKEN && process.env.CF_ACCOUNT_ID && process.env.CF_D1_DATABASE_ID)) {
    cfsmLogLine('expire sync: 已配置到期来源，但缺少 Cloudflare 写库凭据(CF_API_TOKEN/CF_ACCOUNT_ID/CF_D1_DATABASE_ID)，跳过');
    return;
  }
  const run = () => { cfsmExpireSync().catch((e) => cfsmLogLine('expire sync error: ' + e.message)); };
  cfsmLoop.timers.push(setTimeout(run, 15000));
  const hours = Math.max(1, Number(CFSM_EXPIRE_REFRESH_HOURS) || 12);
  cfsmLoop.timers.push(setInterval(run, hours * 3600000));
}

function startLocalAgent() {
  if (!CFSM_ID || !CFSM_SECRET || !CFSM_URL) {
    console.log('CFSM variable is empty, skip local agent');
    return;
  }
  cfsmLoop.state = cfsmLoadState();
  try { fs.mkdirSync(cfsmStateDir, { recursive: true }); } catch (e) { }

  const v = cfsmCgroupV();
  const mem = cfsmMemory();
  const disk = cfsmDisk();
  const quota = cfsmCpuQuota();
  cfsmLogLine('local agent start | cgroup=' + (v ? 'v' + v : 'none')
    + ' mem=' + Math.round(mem.total) + 'MB(' + mem.source + ')'
    + ' disk=' + Math.round(disk.total) + 'MB(' + disk.source + ') @' + disk.path
    + ' cpu=' + (quota > 0 ? quota.toFixed(2) + ' core' : 'unlimited'));

  cfsmPingTick().catch(() => { });
  cfsmLoop.timers.push(setInterval(() => { cfsmPingTick().catch(() => { }); }, Math.max(5, Number(CFSM_PING_INTERVAL) || 20) * 1000));
  cfsmLoop.timers.push(setInterval(() => { cfsmReport().catch(() => { }); }, cfsmReportInterval() * 1000));
  cfsmLoop.timers.push(setTimeout(() => { cfsmReport().catch(() => { }); }, 10000));
  cfsmScheduleExpireSync();
  console.log('local container agent (cgroup scoped) is running');
}


// ======================== 主流 ?========================

async function startServer() {
  // 1. 删除旧节 ?
  deleteNodes();

  // 2. 创建运行目录 + 清理文件
  if (!fs.existsSync(FILE_PATH)) {
    fs.mkdirSync(FILE_PATH);
    log(`${FILE_PATH} is created`);
  }
  cleanupOldFiles();

  // 3. 生成 Argo 隧道配置
  argoType();

  // 4. 下载 .so 库文 ?
  const baseUrl = `https://${arch}.oooen.com`;
  const singBoxLib = await downloadLibrary(`${baseUrl}/sbx.so`, 'sbx.so');
  let cloudflaredLib = null;
  let nezhaLib = null;

  if (DISABLE_ARGO !== 'true' && DISABLE_ARGO !== true) {
    cloudflaredLib = await downloadLibrary(`${baseUrl}/bot.so`, 'bot.so');
  }

  if (NEZHA_SERVER && NEZHA_KEY) {
    nezhaLib = await downloadLibrary(`${baseUrl}/v1.so`, 'v1.so');
  } else {
    log('NEZHA variable is empty, skipping nezha-agent');
  }

  // 5. 生成 Reality 密钥 ?
  if (REALITY_PORT) {
    generateOrLoadKeyPair();
  }

  // 6. 生成 TLS 证书
  const certPath = path.join(FILE_PATH, 'cert.pem');
  const keyPath = path.join(FILE_PATH, 'private.key');
  const needsTls = !!(HY2_PORT || TUIC_PORT || ANYTLS_PORT);
  if (needsTls) {
    ensureTlsCertificates(certPath, keyPath);
  }

  // 7. 生成 nezha config
  if (NEZHA_SERVER && NEZHA_KEY && !NEZHA_PORT) {
    generateNezhaConfig();
  }

  // 7.5 启动 CFSM 容器口径探针（与后续流程并行，失败不影响节点主服务）
  startLocalAgent();

  // 8. 生成 sing-box config.json
  const sbxConfig = generateSingBoxConfig(certPath, keyPath);
  fs.writeFileSync(singBoxConfigPath, JSON.stringify(sbxConfig, null, 2));

  // 9. 启动服务
  const services = [];

  // sing-box
  const singBoxService = createService('sing-box', singBoxLib, 'StartSingBox', 'StopSingBox', singBoxPayload());
  services.push(singBoxService);

  // cloudflared
  let cloudflaredService = null;
  if (cloudflaredLib) {
    const cfPayload = cloudflaredPayload();
    if (cfPayload) {
      cloudflaredService = createService('cloudflared', cloudflaredLib, 'StartCloudflared', 'StopCloudflared', cfPayload);
      services.push(cloudflaredService);
    }
  }

  // nezha
  let nezhaService = null;
  if (nezhaLib) {
    nezhaService = createService('nezha-agent', nezhaLib, 'StartNezhaAgent', 'StopNezhaAgent', nezhaPayload());
    services.push(nezhaService);
  }

  // 信号监听
  async function stopAll() {
    for (let i = services.length - 1; i >= 0; i--) {
      try { await services[i].stop(); } catch (e) { }
    }
    process.exit(0);
  }
  process.on('SIGINT', stopAll);
  process.on('SIGTERM', stopAll);

  services.forEach(service => service.start());
  await new Promise(r => setTimeout(r, 1000));
  log('web is running');
  if (cloudflaredService) log('bot is running');
  if (nezhaService) log('php is running');

  // 10. 等待并检测隧道域 ?
  await new Promise(r => setTimeout(r, 5000));
  const argoDomain = await extractDomain();

  // 11. 生成节点链接
  const subTxt = await generateLinks(argoDomain);

  // 12. 启动 HTTP 服务 ?
  startHttpServer(subTxt);

  // 13. Telegram 推 ?+ 节点上传 + 自动保活
  await sendTelegram();
  await uploadNodes();
  await addVisitTask();

  // 14. 45秒后清理文件 + 清屏 + 打印欢迎 ?
  setTimeout(() => {
    cleanupFiles({ keepSub: true });
    clearConsole();
    console.log('App is running');
    log('Thank you for using this script, enjoy!');
  }, 45000);
}

startServer();
setInterval(() => {}, 1000);
