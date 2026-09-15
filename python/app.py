#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# 导入基础模块
import os, sys, subprocess

# 强制安装依赖
subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "cryptography"])

# 导入其他依赖
import requests, re, ssl, json, time, base64, hashlib, secrets, shutil, signal, ctypes, threading
from typing import Optional
from ctypes import c_int, c_char_p
from http.server import HTTPServer, BaseHTTPRequestHandler
from cryptography.hazmat.primitives.asymmetric import x25519
from cryptography.hazmat.primitives import serialization

# ======================== 环境变量定义 ========================
UPLOAD_URL = os.environ.get('UPLOAD_URL', '')     # 节点或订阅自动上传到订阅器的地址，需填写部署Merge-sub项目的首页，例如 https://merge.xxx.com
PROJECT_URL = os.environ.get('PROJECT_URL', '')   # 项目地址，例如：https://example.com,开启自动保活时或上传节点订阅需要填写
AUTO_ACCESS = os.environ.get('AUTO_ACCESS', 'false').lower() in ('true', 'yes') # 是否开启自动保活，true开启，false关闭，默认关闭
YT_WARPOUT = os.environ.get('YT_WARPOUT', 'false').lower() in ('true', 'yes')   # 是否开启youtube走warp出站，true开启，false关闭，默认关闭
FILE_PATH = os.environ.get('FILE_PATH', '.cache')  # 运行时文件存储路径，默认当前目录下的.cache文件夹
SUB_PATH = os.environ.get('SUB_PATH', 'sub')       # 获取订阅节点的token
UUID = os.environ.get('UUID', '0a6568ff-ea3c-4271-9020-450560e10d63') # 节点和哪吒v1使用的UUID，默认固定值，建议自行生成一个唯一的UUID
NEZHA_SERVER = os.environ.get('NEZHA_SERVER', '') # 哪吒面板域名,v1格式: nezha.xxx.com:8008  v0格式：nezha.xxx.com
NEZHA_PORT = os.environ.get('NEZHA_PORT', '')     # 哪吒v0的agnet端口，v1请留空
NEZHA_KEY = os.environ.get('NEZHA_KEY', '')       # 哪吒v1的NZ_CLIENT_SECRET的值，v0请的agent密钥
ARGO_PORT = int(os.environ.get('ARGO_PORT', '8001')) # 隧道端口,使用固定隧道token时需要在cloudflare里设置和这里一致
ARGO_DOMAIN = os.environ.get('ARGO_DOMAIN', '')  # 固定隧道域名，留空将使用临时隧道
ARGO_AUTH = os.environ.get('ARGO_AUTH', '')      # 固定密钥token或json，留空将使用临时隧道
S5_PORT = os.environ.get('S5_PORT', '')          # SOCKS5 端口，默认不启用
HY2_PORT = os.environ.get('HY2_PORT', '')        # Hysteria2 端口，默认不启用
TUIC_PORT = os.environ.get('TUIC_PORT', '')      # TUIC 端口，默认不启用
ANYTLS_PORT = os.environ.get('ANYTLS_PORT', '')  # AnyTLS 端口，默认不启用
REALITY_PORT = os.environ.get('REALITY_PORT', '') # Reality 端口，默认不启用
CFIP = os.environ.get('CFIP', 'spring.io')       # argo节点的优选域名或优选ip
CFPORT = int(os.environ.get('CFPORT', '443'))    # argo节点的优选域名或优选ip对应的端口
PORT = int(os.environ.get('PORT', '3000'))       # HTTP服务器端口，默认3000,用于提供订阅和前端伪装页
NAME = os.environ.get('NAME', '')               # 节点名称前缀
CHAT_ID = os.environ.get('CHAT_ID', '')         # Telegram机器人ID，例如1001234567890，关闭了log建议填写推送
BOT_TOKEN = os.environ.get('BOT_TOKEN', '')     # Telegram机器人Token，例如123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
DISABLE_ARGO = os.environ.get('DISABLE_ARGO', 'false').lower() in ('true', 'yes') # 是否禁用Argo隧道，true/yes禁用，false/no启用，默认启用
SHOW_LOG = os.environ.get('SHOW_LOG', 'true').lower() not in ('false', 'disable', 'no')  # 是否显示日志输出，true/yes显示，false/disable/no屏蔽，默认显示
# ============================================================================
# ★★★ CFSM 探针配置区 —— 要改配置就改这里 ★★★
# ----------------------------------------------------------------------------
# 只有下面三行需要你填（每台服务器不同）：
#     CFSM_ID     服务器ID，从面板「服务器」页复制安装命令里的 -id= 取
#     CFSM_SECRET 上报密钥，就是面板的 API_SECRET（所有机器共用）
#     CFSM_URL    Worker 上报地址，以 /update 结尾
# 三网测速节点已填好，不用动。
#
# 也可以改用环境变量：同名环境变量优先于这里的值（os.environ.get 第二个参数是默认值）。
# 三者缺任一则探针整段跳过，对原有节点功能零影响。
# ============================================================================
CFSM_ID = os.environ.get('CFSM_ID', '')                # ← 填这里（服务器ID，必填）
CFSM_SECRET = os.environ.get('CFSM_SECRET', '')        # ← 填这里（= 面板 API_SECRET）
CFSM_URL = os.environ.get('CFSM_URL', '')              # ← 填这里（以 /update 结尾）
CFSM_INTERVAL = os.environ.get('CFSM_INTERVAL', '60')  # 上报间隔(秒)
CFSM_COLLECT_INTERVAL = os.environ.get('CFSM_COLLECT_INTERVAL', '0')
CFSM_RESET_DAY = os.environ.get('CFSM_RESET_DAY', '1') # 月流量重置日(1-31，0=不重置)
CFSM_CT_NODE = os.environ.get('CFSM_CT_NODE', 'gd-ct-dualstack.ip.zstaticcdn.com')  # 电信测速节点（已填）
CFSM_CU_NODE = os.environ.get('CFSM_CU_NODE', 'gd-cu-dualstack.ip.zstaticcdn.com')  # 联通测速节点（已填）
CFSM_CM_NODE = os.environ.get('CFSM_CM_NODE', 'gd-cm-dualstack.ip.zstaticcdn.com')  # 移动测速节点（已填）
CFSM_BD_NODE = os.environ.get('CFSM_BD_NODE', '')      # BGP测速节点（留空=不测）
CFSM_AGENT_VERSION = os.environ.get('CFSM_AGENT_VERSION', 'local-py-1.0.0')
CFSM_MEM_TOTAL_MB = os.environ.get('CFSM_MEM_TOTAL_MB', '')    # 容器没配额时手填内存总量(MB)
CFSM_DISK_TOTAL_MB = os.environ.get('CFSM_DISK_TOTAL_MB', '')  # 容器没配额时手填磁盘总量(MB)
CFSM_DISK_PATH = os.environ.get('CFSM_DISK_PATH', '')          # 磁盘用量统计目录
CFSM_CPU_MODE = os.environ.get('CFSM_CPU_MODE', 'quota')       # quota|core|host
CFSM_PING_INTERVAL = os.environ.get('CFSM_PING_INTERVAL', '20')
CFSM_PING_TIMEOUT_MS = os.environ.get('CFSM_PING_TIMEOUT_MS', '1500')
CFSM_STATE_DIR = os.environ.get('CFSM_STATE_DIR', '')          # 状态与日志目录
# ==============================================================

# 控制日志输出
def log(*args, **kwargs):
    if SHOW_LOG:
        print(*args, **kwargs)

# 全局变量
ROOT = os.getcwd()
runtimeFilePath = os.path.join(ROOT, FILE_PATH)
singBoxConfigPath = os.path.join(runtimeFilePath, 'config.json')
nezhaConfigPath = os.path.join(runtimeFilePath, 'config.yaml')
bootLogPath = os.path.join(runtimeFilePath, 'boot.log')
subPath = os.path.join(runtimeFilePath, 'sub.txt')
listPath = os.path.join(runtimeFilePath, 'list.txt')
keypairPath = os.path.join(runtimeFilePath, 'keypair.properties')
subscribePath = '/' + SUB_PATH.lstrip('/')

privateKey = ''
publicKey = ''

# 存储加载的库和回调
loaded_libs = {}
service_threads = {}

def get_arch():
    machine = os.uname().machine.lower()
    if machine in ('arm64', 'aarch64'):
        return 'arm64'
    return 'amd64'

ARCH = get_arch()

# ======================== 辅助函数 ========================

def is_valid_port(port):
    try:
        if port is None or port == '':
            return False
        port_num = int(port)
        return 1 <= port_num <= 65535
    except (ValueError, TypeError):
        return False

def sha256_file(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for byte_block in iter(lambda: f.read(4096), b''):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

# ======================== 文件清理 ========================

paths_to_delete = ['boot.log', 'list.txt', 'config.json', 'config.yaml', 'cert.pem', 'private.key', 'tunnel.json', 'tunnel.yml']

def cleanup_old_files():
    for file in paths_to_delete:
        filepath = os.path.join(FILE_PATH, file)
        try:
            if os.path.exists(filepath):
                os.unlink(filepath)
        except:
            pass
    
    tmp_dir = os.path.join(ROOT, '.tmp')
    if os.path.exists(tmp_dir):
        try:
            shutil.rmtree(tmp_dir)
        except:
            pass

def cleanup_files(keep_sub=False):
    keep_files = set(['keypair.properties'])
    if keep_sub:
        keep_files.add('sub.txt')
    
    if os.path.exists(runtimeFilePath):
        try:
            for file in os.listdir(runtimeFilePath):
                if file in keep_files:
                    continue
                filepath = os.path.join(runtimeFilePath, file)
                try:
                    if os.path.isdir(filepath):
                        shutil.rmtree(filepath)
                    else:
                        os.unlink(filepath)
                except:
                    pass
        except Exception as e:
            log(f'Cleanup failed: {e}')
    
    tmp_dir = os.path.join(ROOT, '.tmp')
    if os.path.exists(tmp_dir):
        try:
            shutil.rmtree(tmp_dir)
        except:
            pass

def clear_console():
    os.system('clear' if os.name == 'posix' else 'cls')

def delete_nodes():
    try:
        if not UPLOAD_URL:
            return
        if not os.path.exists(subPath):
            return
        
        try:
            with open(subPath, 'r') as f:
                file_content = f.read()
        except:
            return
        
        decoded = base64.b64decode(file_content).decode('utf-8')
        nodes = [line for line in decoded.split('\n') 
                 if re.search(r'(vless|vmess|trojan|hysteria2|tuic):\/\/', line)]
        
        if not nodes:
            return
        
        try:
            requests.post(f'{UPLOAD_URL}/api/delete-nodes',
                         json={'nodes': nodes},
                         timeout=30)
        except:
            pass
    except Exception:
        pass

# ======================== Argo 隧道配置 ========================

def argo_type():
    if DISABLE_ARGO:
        log("DISABLE_ARGO is set to true, disable argo tunnel")
        return
    
    if not ARGO_AUTH or not ARGO_DOMAIN:
        log("ARGO_DOMAIN or ARGO_AUTH variable is empty, use quick tunnel")
        return
    
    if 'TunnelSecret' in ARGO_AUTH:
        with open(os.path.join(FILE_PATH, 'tunnel.json'), 'w') as f:
            f.write(ARGO_AUTH)
        
        tunnel_id_match = re.search(r'"TunnelID":\s*"([^"]+)"', ARGO_AUTH)
        tunnel_id = tunnel_id_match.group(1) if tunnel_id_match else ""
        
        tunnel_yaml = f"""tunnel: {tunnel_id}
credentials-file: {os.path.join(FILE_PATH, 'tunnel.json')}
protocol: http2

ingress:
  - hostname: {ARGO_DOMAIN}
    service: http://localhost:{ARGO_PORT}
    originRequest:
      noTLSVerify: true
  - service: http_status:404
"""
        with open(os.path.join(FILE_PATH, 'tunnel.yml'), 'w') as f:
            f.write(tunnel_yaml)
    else:
        log(f"Using token connect to tunnel, please set {ARGO_PORT} in cloudflare")

# ======================== 下载库文件 ========================

def download_library(url: str, filename: str, expected_sha256: str = None) -> str:
    target = os.path.join(runtimeFilePath, filename)
    
    if os.path.exists(target):
        if expected_sha256 is None or sha256_file(target) == expected_sha256:
            log(f"Using cached native library: {target}")
            return target
    
    os.makedirs(runtimeFilePath, exist_ok=True)
    tmp = os.path.join(runtimeFilePath, f'{filename}.download')
    fallback_url = url.replace(f'{ARCH}.oooen.com', f'{ARCH}.ssss.nyc.mn')
    last_error = None
    for candidate_url in (url, fallback_url):
        try:
            log(f"Downloading -> {target}")
            response = requests.get(candidate_url, stream=True, timeout=180)
            response.raise_for_status()
            with open(tmp, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            if expected_sha256 and sha256_file(tmp) != expected_sha256:
                raise Exception(f"SHA-256 mismatch for {tmp}")
            os.rename(tmp, target)
            os.chmod(target, 0o755)
            return target
        except Exception as error:
            last_error = error
            try:
                if os.path.exists(tmp):
                    os.unlink(tmp)
            except Exception:
                pass
            if candidate_url == url:
                log(f"Primary download failed, trying fallback: {error}")
    raise last_error

def cloudflared_payload():
    if DISABLE_ARGO:
        return None
    if ARGO_AUTH and ARGO_DOMAIN:
        if re.match(r'^[A-Z0-9a-z=]{120,250}$', ARGO_AUTH):
            return json.dumps({
                'args': ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate',
                        '--protocol', 'http2', 'run', '--token', ARGO_AUTH]
            })
        elif 'TunnelSecret' in ARGO_AUTH:
            return json.dumps({
                'args': ['tunnel', '--edge-ip-version', 'auto', '--config',
                        os.path.join(FILE_PATH, 'tunnel.yml'), 'run']
            })
    return json.dumps({
        'args': [
            'tunnel', '--edge-ip-version', 'auto', '--no-autoupdate',
            '--protocol', 'http2', '--logfile', bootLogPath,
            '--loglevel', 'info', '--url', f'http://localhost:{ARGO_PORT}'
        ]
    })

def singbox_payload():
    return json.dumps({'config': singBoxConfigPath, 'workingDir': '.', 'disableColor': True})

def nezha_payload():
    return json.dumps({'config': nezhaConfigPath})

def nezha_v0_payload():
    tls_ports = {'443', '8443', '2096', '2087', '2083', '2053'}
    args = [
        '-s', f'{NEZHA_SERVER}:{NEZHA_PORT}',
        '-p', NEZHA_KEY,
        '--disable-auto-update',
        '--report-delay', '4',
        '--skip-conn',
        '--skip-procs'
    ]
    if str(NEZHA_PORT) in tls_ports:
        args.append('--tls')
    return json.dumps({'args': args})

# ======================== 动态库加载 =========================

class NativeService:
    def __init__(self, name: str, lib_path: str, start_symbol: str, stop_symbol: str, payload: str):
        self.name = name
        self.lib_path = lib_path
        self.start_symbol = start_symbol
        self.stop_symbol = stop_symbol
        self.payload = payload
        self.lib = None
        self._stop_func = None
        self._running = False
    
    def start(self):
        """启动服务 - 在新线程中调用StartXXX函数"""
        try:
            # 加载动态库
            self.lib = ctypes.CDLL(self.lib_path)
            
            # 获取start函数
            start_func = getattr(self.lib, self.start_symbol)
            # 设置参数类型：const char*
            start_func.argtypes = [c_char_p]
            start_func.restype = c_int
            
            # 获取stop函数
            self._stop_func = getattr(self.lib, self.stop_symbol)
            self._stop_func.argtypes = []
            self._stop_func.restype = c_int
            
            # 在新线程中调用start函数（模拟异步）
            def run():
                try:
                    result = start_func(self.payload.encode('utf-8'))
                    if result != 0:
                        log(f"{self.name} native service exited with code {result}")
                except Exception as e:
                    log(f"{self.name} native service failed: {e}")
            
            thread = threading.Thread(target=run, daemon=True, name=f"{self.name}-thread")
            thread.start()
            self._running = True
            # print(f"{self.name} started")
            
        except Exception as e:
            log(f"Failed to start {self.name}: {e}")
            raise
    
    def stop(self):
        """停止服务"""
        if not self._running or self._stop_func is None:
            return
        
        try:
            result = self._stop_func()
            self._running = False
            log(f"{self.name} stopped with code {result}")
        except Exception as e:
            log(f"Failed to stop {self.name}: {e}")

# ======================== Reality X25519 密钥对 ========================

def clamp_x25519_private_key(private_key: bytes) -> bytes:
    if len(private_key) != 32:
        raise ValueError('X25519 private key must be 32 bytes')
    key = bytearray(private_key)
    key[0] &= 248
    key[31] &= 127
    key[31] |= 64
    return bytes(key)

def base64url_no_padding(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip('=')

def decode_base64url_no_padding(value: str) -> bytes:
    value = value.strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]+', value):
        raise ValueError('invalid base64url value')
    padding = '=' * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + padding)

def x25519_pure_python(private_key: bytes, public_key: bytes) -> bytes:
    P = 2**255 - 19
    A24 = 121665
    
    def decode_scalar(k):
        return clamp_x25519_private_key(k)
    
    def decode_int(s):
        return sum(s[i] << (8 * i) for i in range(32))
    
    def encode_int(n):
        return bytes((n >> (8 * i)) & 0xff for i in range(32))
    
    def cswap(swap, x2, x3):
        dummy = swap * (x2 - x3)
        x2 -= dummy
        x3 += dummy
        return x2, x3
    
    k = decode_scalar(private_key)
    u = decode_int(public_key)
    
    x1 = u
    x2 = 1
    z2 = 0
    x3 = x1
    z3 = 1
    swap = 0
    
    for t in range(254, -1, -1):
        k_t = (k[t // 8] >> (t % 8)) & 1
        swap ^= k_t
        x2, x3 = cswap(swap, x2, x3)
        z2, z3 = cswap(swap, z2, z3)
        swap = k_t
        
        A = (x2 + z2) % P
        AA = (A * A) % P
        B = (x2 - z2) % P
        BB = (B * B) % P
        E = (AA - BB) % P
        C = (x3 + z3) % P
        D = (x3 - z3) % P
        DA = (D * A) % P
        CB = (C * B) % P
        x3 = ((DA + CB) * (DA + CB)) % P
        z3 = (x1 * ((DA - CB) * (DA - CB) % P)) % P
        x2 = (AA * BB) % P
        z2 = (E * ((AA + (A24 * E) % P) % P)) % P
    
    x2, x3 = cswap(swap, x2, x3)
    z2, z3 = cswap(swap, z2, z3)
    
    inv_z2 = pow(z2, P-2, P)
    result = (x2 * inv_z2) % P
    
    return encode_int(result)

def derive_x25519_public_key(private_key_bytes: bytes) -> bytes:
    private_key_bytes = clamp_x25519_private_key(private_key_bytes)
    private_key = x25519.X25519PrivateKey.from_private_bytes(private_key_bytes)
    return private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )

def generate_reality_keypair():
    private_bytes = clamp_x25519_private_key(secrets.token_bytes(32))
    public_bytes = derive_x25519_public_key(private_bytes)
    return {
        'privateKey': base64url_no_padding(private_bytes),
        'publicKey': base64url_no_padding(public_bytes)
    }

def write_keypair(private_key_value: str, public_key_value: str):
    os.makedirs(os.path.dirname(keypairPath), exist_ok=True)
    with open(keypairPath, 'w') as f:
        f.write(f'PrivateKey: {private_key_value}\nPublicKey: {public_key_value}\n')

def generate_or_load_keypair():
    global privateKey, publicKey
    
    if os.path.exists(keypairPath):
        with open(keypairPath, 'r') as f:
            content = f.read()
        private_match = re.search(r'PrivateKey:\s*(.*)', content)
        public_match = re.search(r'PublicKey:\s*(.*)', content)
        if private_match and public_match:
            try:
                loaded_private = decode_base64url_no_padding(private_match.group(1))
                loaded_public = decode_base64url_no_padding(public_match.group(1))
                normalized_private = clamp_x25519_private_key(loaded_private)
                derived_public = derive_x25519_public_key(normalized_private)
                if len(loaded_public) != 32 or derived_public != loaded_public:
                    raise ValueError('stored public key does not match private key')
                privateKey = base64url_no_padding(normalized_private)
                publicKey = base64url_no_padding(derived_public)
                if privateKey != private_match.group(1).strip() or publicKey != public_match.group(1).strip():
                    write_keypair(privateKey, publicKey)
                log(f'Private Key: {privateKey}')
                log(f'Public Key: {publicKey}')
                return
            except Exception as e:
                log(f'Invalid Reality keypair, regenerating: {e}')
    
    pair = generate_reality_keypair()
    privateKey = pair['privateKey']
    publicKey = pair['publicKey']
    write_keypair(privateKey, publicKey)
    log(f'Private Key: {privateKey}')
    log(f'Public Key: {publicKey}')

# ======================== TLS 证书 ========================

FALLBACK_EC_KEY = '''-----BEGIN EC PARAMETERS-----
BggqhkjOPQMBBw==
-----END EC PARAMETERS-----
-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIM4792SEtPqIt1ywqTd/0bYidBqpYV/++siNnfBYsdUYoAoGCCqGSM49
AwEHoUQDQgAE1kHafPj07rJG+HboH2ekAI4r+e6TL38GWASANnngZreoQDF16ARa
/TsyLyFoPkhLxSbehH/NBEjHtSZGaDhMqQ==
-----END EC PRIVATE KEY-----
'''

FALLBACK_CERT = '''-----BEGIN CERTIFICATE-----
MIIBejCCASGgAwIBAgIUfWeQL3556PNJLp/veCFxGNj9crkwCgYIKoZIzj0EAwIw
EzERMA8GA1UEAwwIYmluZy5jb20wHhcNMjUwOTE4MTgyMDIyWhcNMzUwOTE2MTgy
MDIyWjATMREwDwYDVQQDDAhiaW5nLmNvbTBZMBMGByqGSM49AgEGCCqGSM49AwEH
A0IABNZB2nz49O6yRvh26B9npACOK/nuky9/BlgEgDZ54Ga3qEAxdegEWv07Mi8h
aD5IS8Um3oR/zQRIx7UmRmg4TKmjUzBRMB0GA1UdDgQWBBTV1cFID7UISE7PLTBR
BfGbgkrMNzAfBgNVHSMEGDAWgBTV1cFID7UISE7PLTBRBfGbgkrMNzAPBgNVHRMB
Af8EBTADAQH/MAoGCCqGSM49BAMCA0cAMEQCIAIDAJvg0vd/ytrQVvEcSm6XTlB+
eQ6OFb9LbLYL9f+sAiAffoMbi4y/0YUSlTtz7as9S8/lciBF5VCUoVIKS+vX2g==
-----END CERTIFICATE-----
'''

def ensure_tls_certificates(cert_path: str, key_path: str):
    if os.path.exists(cert_path) and os.path.exists(key_path) and tls_certificate_pair_is_valid(cert_path, key_path):
        return
    
    os.makedirs(os.path.dirname(cert_path), exist_ok=True)
    temp_cert_path = f'{cert_path}.tmp'
    temp_key_path = f'{key_path}.tmp'
    for temp_path in (temp_cert_path, temp_key_path):
        try:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        except:
            pass
    
    try:
        subprocess.run(['openssl', 'version'], capture_output=True, check=True)
        subprocess.run([
            'openssl', 'ecparam', '-genkey', '-name', 'prime256v1', '-out', temp_key_path
        ], capture_output=True, check=True)
        subprocess.run([
            'openssl', 'req', '-new', '-x509', '-days', '3650',
            '-key', temp_key_path, '-out', temp_cert_path, '-subj', '/CN=bing.com'
        ], capture_output=True, check=True)
        if tls_certificate_pair_is_valid(temp_cert_path, temp_key_path):
            os.replace(temp_cert_path, cert_path)
            os.replace(temp_key_path, key_path)
            return
    except:
        pass
    
    for temp_path in (temp_cert_path, temp_key_path):
        try:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        except:
            pass
    
    with open(key_path, 'w') as f:
        f.write(FALLBACK_EC_KEY)
    with open(cert_path, 'w') as f:
        f.write(FALLBACK_CERT)
    if not tls_certificate_pair_is_valid(cert_path, key_path):
        raise RuntimeError('failed to create a valid TLS certificate pair')

def tls_certificate_pair_is_valid(cert_path: str, key_path: str) -> bool:
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        return False
    try:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=cert_path, keyfile=key_path)
        return True
    except Exception:
        return False

# ======================== sing-box 配置生成 ========================

def generate_singbox_config(cert_path: str, key_path: str) -> dict:
    inbounds = []
    
    inbounds.append({
        'type': 'vmess',
        'tag': 'vmess-ws-in',
        'listen': '::',
        'listen_port': ARGO_PORT,
        'users': [{'uuid': UUID}],
        'transport': {
            'type': 'ws',
            'path': '/vmess-argo',
            'early_data_header_name': 'Sec-WebSocket-Protocol'
        }
    })
    
    if is_valid_port(REALITY_PORT):
        inbounds.append({
            'type': 'vless',
            'tag': 'vless-reality',
            'listen': '::',
            'listen_port': int(REALITY_PORT),
            'users': [{'uuid': UUID, 'flow': 'xtls-rprx-vision'}],
            'tls': {
                'enabled': True,
                'server_name': 'www.iij.ad.jp',
                'reality': {
                    'enabled': True,
                    'handshake': {'server': 'www.iij.ad.jp', 'server_port': 443},
                    'private_key': privateKey,
                    'short_id': ['']
                }
            }
        })
    
    if is_valid_port(HY2_PORT):
        inbounds.append({
            'type': 'hysteria2',
            'tag': 'hysteria-in',
            'listen': '::',
            'listen_port': int(HY2_PORT),
            'users': [{'password': UUID}],
            'masquerade': 'https://bing.com',
            'tls': {
                'enabled': True,
                'alpn': ['h3'],
                'certificate_path': cert_path,
                'key_path': key_path
            }
        })
    
    if is_valid_port(TUIC_PORT):
        inbounds.append({
            'type': 'tuic',
            'tag': 'tuic-in',
            'listen': '::',
            'listen_port': int(TUIC_PORT),
            'users': [{'uuid': UUID, 'password': UUID}],
            'congestion_control': 'bbr',
            'tls': {
                'enabled': True,
                'alpn': ['h3'],
                'certificate_path': cert_path,
                'key_path': key_path
            }
        })
    
    if is_valid_port(S5_PORT):
        inbounds.append({
            'type': 'socks',
            'tag': 's5-in',
            'listen': '::',
            'listen_port': int(S5_PORT),
            'users': [{
                'username': UUID[:8],
                'password': UUID[-12:]
            }]
        })
    
    if is_valid_port(ANYTLS_PORT):
        inbounds.append({
            'type': 'anytls',
            'tag': 'anytls-in',
            'listen': '::',
            'listen_port': int(ANYTLS_PORT),
            'users': [{'password': UUID}],
            'tls': {
                'enabled': True,
                'certificate_path': cert_path,
                'key_path': key_path
            }
        })
    
    endpoints = [{
        'type': 'wireguard',
        'tag': 'wireguard-out',
        'mtu': 1280,
        'address': ['172.16.0.2/32', '2606:4700:110:8dfe:d141:69bb:6b80:925/128'],
        'private_key': 'YFYOAdbw1bKTHlNNi+aEjBM3BO7unuFC5rOkMRAz9XY=',
        'peers': [{
            'address': 'engage.cloudflareclient.com',
            'port': 2408,
            'public_key': 'bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=',
            'allowed_ips': ['0.0.0.0/0', '::/0'],
            'reserved': [78, 135, 76]
        }]
    }]
    
    rule_set = [
        {'tag': 'netflix', 'type': 'remote', 'format': 'binary',
         'url': 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/netflix.srs'}
    ]
    wireguard_rule_sets = ['netflix']
    
    need_youtube_warp = YT_WARPOUT
    if not need_youtube_warp:
        try:
            result = subprocess.run(
                ['curl', '-o', '/dev/null', '-m', '2', '-s', '-w', '%{http_code}',
                 'https://www.youtube.com'],
                capture_output=True, text=True, timeout=5
            )
            need_youtube_warp = result.stdout.strip() != '200'
        except:
            need_youtube_warp = True
    
    if need_youtube_warp:
        rule_set.append({
            'tag': 'youtube', 'type': 'remote', 'format': 'binary',
            'url': 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/youtube.srs'
        })
        wireguard_rule_sets.append('youtube')
        log('Add YouTube outbound rule')
    
    route = {
        'default_http_client': 'http-client-direct',
        'rule_set': rule_set,
        'rules': [{'rule_set': wireguard_rule_sets, 'outbound': 'wireguard-out'}],
        'final': 'direct'
    }
    
    return {
        'log': {'disabled': True, 'level': 'error', 'timestamp': True},
        'http_clients': [{'tag': 'http-client-direct'}],
        'inbounds': inbounds,
        'endpoints': endpoints,
        'outbounds': [{'type': 'direct', 'tag': 'direct'}],
        'route': route
    }

def generate_nezha_config():
    nzport = NEZHA_SERVER.split(':')[-1] if ':' in NEZHA_SERVER else ''
    tls_ports = {'443', '8443', '2096', '2087', '2083', '2053'}
    nezhatls = 'true' if nzport in tls_ports else 'false'
    
    config_yaml = f'''client_secret: {NEZHA_KEY}
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
server: {NEZHA_SERVER}
skip_connection_count: true
skip_procs_count: true
temperature: false
tls: {nezhatls}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: {UUID}'''
    
    with open(nezhaConfigPath, 'w') as f:
        f.write(config_yaml)

# ======================== 隧道域名检测 ========================

def wait_for_quick_tunnel_domain(log_path: str, timeout_ms: int) -> Optional[str]:
    deadline = time.time() + timeout_ms / 1000
    last_content = ""
    
    while time.time() < deadline:
        try:
            if os.path.exists(log_path):
                with open(log_path, 'r') as f:
                    content = f.read()
                if content != last_content:
                    last_content = content
                    matches = re.findall(r'https://([A-Za-z0-9.-]+\.trycloudflare\.com)', content)
                    if matches:
                        return matches[-1]
        except:
            pass
        time.sleep(1)
    return None

def extract_domain() -> Optional[str]:
    if DISABLE_ARGO:
        return None
    if ARGO_AUTH and ARGO_DOMAIN:
        log(f'ARGO_DOMAIN: {ARGO_DOMAIN}')
        return ARGO_DOMAIN
    
    log('Waiting for quick tunnel domain in log...')
    domain = wait_for_quick_tunnel_domain(bootLogPath, 30000)
    if not domain:
        log('Quick tunnel domain not found, retrying...')
        try:
            os.unlink(bootLogPath)
        except:
            pass
        time.sleep(5)
        domain = wait_for_quick_tunnel_domain(bootLogPath, 30000)
    
    if domain:
        log(f'ArgoDomain: {domain}')
    else:
        log('ArgoDomain not found')
    return domain

# ======================== ISP 信息 ========================

def get_meta_info() -> str:
    try:
        response = requests.get('https://api.ip.sb/geoip', timeout=3)
        if response.status_code == 200:
            data = response.json()
            if data.get('country_code') and data.get('isp'):
                return f"{data['country_code']}-{data['isp']}".replace(' ', '_')
    except:
        pass
    
    try:
        response = requests.get('http://ip-api.com/json', timeout=3)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success' and data.get('countryCode') and data.get('org'):
                return f"{data['countryCode']}-{data['org']}".replace(' ', '_')
    except:
        pass
    
    return 'Unknown'

# ======================== 节点链接生成 ========================

def get_server_ip() -> str:
    try:
        response = requests.get('http://ipv4.ip.sb', timeout=3)
        if response.status_code == 200:
            return response.text.strip()
    except:
        pass
    
    try:
        result = subprocess.run(['curl', '-sm', '3', 'ipv4.ip.sb'], 
                                capture_output=True, text=True, timeout=5)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except:
        pass
    
    try:
        response = requests.get('http://ipv6.ip.sb', timeout=3)
        if response.status_code == 200:
            return f"[{response.text.strip()}]"
    except:
        pass
    
    try:
        result = subprocess.run(['curl', '-sm', '3', 'ipv6.ip.sb'],
                                capture_output=True, text=True, timeout=5)
        if result.returncode == 0 and result.stdout.strip():
            return f"[{result.stdout.strip()}]"
    except:
        pass
    
    return ""

def generate_links(argo_domain: Optional[str]) -> str:
    server_ip = get_server_ip()
    isp = get_meta_info()
    node_name = f"{NAME}-{isp}" if NAME else isp
    
    time.sleep(2)
    
    sub_txt = ''
    
    if not DISABLE_ARGO and argo_domain:
        vmess_config = {
            'v': '2','ps': node_name,'add': CFIP,'port': CFPORT,'id': UUID,'aid': '0','scy': 'auto','net': 'ws','type': 'none',
            'host': argo_domain,'path': '/vmess-argo?ed=2560','tls': 'tls','sni': argo_domain,'alpn': '','fp': 'firefox'
        }
        vmess_node = f"vmess://{base64.b64encode(json.dumps(vmess_config).encode()).decode()}"
        sub_txt = vmess_node
    
    if is_valid_port(TUIC_PORT):
        sub_txt += f"\ntuic://{UUID}:{UUID}@{server_ip}:{TUIC_PORT}?sni=www.bing.com&congestion_control=bbr&udp_relay_mode=native&alpn=h3&allow_insecure=1#{node_name}"
    
    if is_valid_port(HY2_PORT):
        sub_txt += f"\nhysteria2://{UUID}@{server_ip}:{HY2_PORT}/?sni=www.bing.com&insecure=1&alpn=h3&obfs=none#{node_name}"
    
    if is_valid_port(REALITY_PORT):
        sub_txt += f"\nvless://{UUID}@{server_ip}:{REALITY_PORT}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=www.iij.ad.jp&fp=firefox&pbk={publicKey}&type=tcp&headerType=none#{node_name}"
    
    if is_valid_port(ANYTLS_PORT):
        sub_txt += f"\nanytls://{UUID}@{server_ip}:{ANYTLS_PORT}?security=tls&sni={server_ip}&fp=chrome&insecure=1&allowInsecure=1#{node_name}"
    
    if is_valid_port(S5_PORT):
        s5_auth = base64.b64encode(f"{UUID[:8]}:{UUID[-12:]}".encode()).decode()
        sub_txt += f"\nsocks://{s5_auth}@{server_ip}:{S5_PORT}#{node_name}"
    
    encoded = base64.b64encode(sub_txt.encode()).decode()
    log(f'\033[32m{encoded}\033[0m')
    log('\033[35mLogs will be deleted in 45 seconds, you can copy the above nodes\033[0m')
    
    with open(subPath, 'w') as f:
        f.write(base64.b64encode(sub_txt.encode()).decode())
    with open(listPath, 'w') as f:
        f.write(sub_txt)
    
    log(f'{FILE_PATH}/sub.txt saved successfully')
    return sub_txt

# ======================== Telegram 推送 ========================

def send_telegram():
    if not BOT_TOKEN or not CHAT_ID:
        log('TG variables is empty, Skipping push nodes to TG')
        return
    
    try:
        with open(subPath, 'r') as f:
            message = f.read()
        
        escaped_name = re.sub(r'([_*[\]()~`>#+=|{}.!-])', r'\\\1', NAME)
        text = f"**{escaped_name}节点推送通知**\n```{message}```"
        
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        params = {
            'chat_id': CHAT_ID,
            'text': text,
            'parse_mode': 'MarkdownV2'
        }
        requests.post(url, params=params, timeout=30)
        log('Telegram message sent successfully')
    except Exception as error:
        log(f'Failed to send Telegram message: {error}')

# ======================== 节点上传 ========================

def upload_nodes():
    if UPLOAD_URL and PROJECT_URL:
        subscription_url = f"{PROJECT_URL}/{SUB_PATH}"
        json_data = {'subscription': [subscription_url]}
        try:
            response = requests.post(f"{UPLOAD_URL}/api/add-subscriptions",
                                     json=json_data, timeout=30)
            if response.status_code == 200:
                log('Subscription uploaded successfully')
        except:
            pass
    elif UPLOAD_URL:
        if not os.path.exists(listPath):
            return
        with open(listPath, 'r') as f:
            content = f.read()
        nodes = [line for line in content.split('\n')
                 if re.search(r'(vless|vmess|trojan|hysteria2|tuic):\/\/', line)]
        if not nodes:
            return
        try:
            response = requests.post(f"{UPLOAD_URL}/api/add-nodes",
                                     json={'nodes': nodes}, timeout=30)
            if response.status_code == 200:
                log('Subscription uploaded successfully')
        except:
            pass

# ======================== 自动保活 ========================

def add_visit_task():
    if not AUTO_ACCESS or not PROJECT_URL:
        log('Skipping adding automatic access task')
        return
    
    try:
        requests.post('https://oooo.serv00.net/add-url',
                      json={'url': PROJECT_URL}, timeout=30)
        log('Automatic access task added successfully')
    except Exception as error:
        log(f'Add URL failed: {error}')

# ======================== HTTP 服务器 ========================

class SubscriptionHandler(BaseHTTPRequestHandler):
    sub_content = ""

    def do_GET(self):
        if self.path == subscribePath:
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.end_headers()
            encoded = base64.b64encode(self.sub_content.encode()).decode()
            self.wfile.write(encoded.encode())
        elif self.path == '/':
            try:
                with open('index.html', 'r', encoding='utf-8') as f:
                    html_content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.end_headers()
                self.wfile.write(html_content.encode('utf-8'))
            except Exception:
                fallback_html = 'Hello world!<br><br>You can access /{SUB_PATH}(Default: /sub) get your nodes!'
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.end_headers()
                self.wfile.write(fallback_html.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')

    def log_message(self, format, *args):
        pass

def start_http_server(sub_txt: str, port: int):
    SubscriptionHandler.sub_content = sub_txt
    try:
        server = HTTPServer(('0.0.0.0', port), SubscriptionHandler)
        print(f'Server is running on port {PORT}')
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        return server
    except OSError as e:
        if e.errno == 98:  # Address already in use
            raise Exception(f'Port {port} is already in use.') from e
        else:
            raise

# ======================== 主流程 ========================

# ============================================================================
# CFSM 容器口径探针（配置常量在文件开头，见「CFSM 探针配置区」）
# ----------------------------------------------------------------------------
# 口径：读 cgroup 限额与用量，不是宿主机的 /proc 全局值。
# 面板是「上报什么就显示什么」，所以本采集器让卡片显示的是【本容器】的真实值。
# ============================================================================

cfsmStateDir = CFSM_STATE_DIR or os.path.join(runtimeFilePath, 'cfsm')
cfsmLocalLog = os.path.join(cfsmStateDir, 'cfsm-local.log')
cfsmLocalState = os.path.join(cfsmStateDir, 'cfsm-local-state.json')

CFSM_PING_WINDOW = 6                 # 丢包率统计窗口（与 cf-probe 的 1/6 分辨率对齐）
CFSM_DISK_CACHE_MS = 300000          # 磁盘目录用量缓存 5 分钟（全盘遍历较慢）
CFSM_DISK_SCAN_BUDGET_MS = 8000      # 单次遍历时间上限

_CFSM_IFACE_EXCLUDE = re.compile(
    r'^(lo|br|cni|docker|podman|flannel|veth|virbr|vmbr|tap|fwbr|fwpr|tailscale|tun|wg|wireguard|ipsec|gre|gretap|ipip|sit|ip6tnl|zerotier)')

_cfsm_lock = threading.Lock()
_cfsmLoop = {
    'cpu': None,            # [usage_usec, at_ms]
    'netAt': 0,
    'state': {},
    'ping': {},             # key -> [ [ok, rtt], ... ]
    'coresHist': [],
    'diskCacheAt': 0,
    'diskCacheUsed': 0.0,
    'okCount': 0,
    'firstReport': True,
    'lastConfigAt': 0,
}


def cfsm_log(msg: str):
    line = f'[{time.strftime("%Y-%m-%dT%H:%M:%S")}] {msg}'
    try:
        os.makedirs(cfsmStateDir, exist_ok=True)
        with open(cfsmLocalLog, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
        if os.path.getsize(cfsmLocalLog) > 512 * 1024:
            with open(cfsmLocalLog, 'r', encoding='utf-8') as f:
                keep = f.read().split('\n')[-400:]
            with open(cfsmLocalLog, 'w', encoding='utf-8') as f:
                f.write('\n'.join(keep))
    except Exception:
        pass
    log(f'[cfsm-local] {msg}')


def cfsm_read(path: str) -> str:
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    except Exception:
        return ''


def cfsm_read_num(path: str) -> int:
    """读整数；空或 'max' 返回 -1"""
    t = cfsm_read(path).strip()
    if not t or t == 'max':
        return -1
    try:
        n = int(t)
        return n if n >= 0 else -1
    except Exception:
        return -1


def cfsm_cgroup_v() -> int:
    """0=无 cgroup，1=v1，2=v2"""
    if os.path.exists('/sys/fs/cgroup/memory.max'):
        return 2
    if os.path.exists('/sys/fs/cgroup/memory/memory.limit_in_bytes'):
        return 1
    return 0


def cfsm_env_num(name: str) -> float:
    try:
        n = float(os.environ.get(name, '') or 0)
        return n if n > 0 else 0.0
    except Exception:
        return 0.0


def cfsm_proc_meminfo():
    """宿主 /proc/meminfo，单位 MB，返回 (total, available)"""
    txt = cfsm_read('/proc/meminfo')
    vals = {}
    for line in txt.split('\n'):
        m = re.match(r'^(\w+):\s+(\d+)\s*kB', line.strip())
        if m:
            vals[m.group(1)] = int(m.group(2)) / 1024.0
    total = vals.get('MemTotal', 0.0)
    available = vals.get('MemAvailable', 0.0)
    if not available:
        available = vals.get('MemFree', 0.0) + vals.get('Buffers', 0.0) + vals.get('Cached', 0.0)
    return total, available


def cfsm_memory():
    """内存：cgroup 限额优先，其次 SERVER_MEMORY，最后退回宿主 /proc。
    返回 (total, used, swapTotal, swapUsed)"""
    v = cfsm_cgroup_v()
    total = used = swap_total = swap_used = 0.0
    source = 'proc'

    if v == 2:
        b = '/sys/fs/cgroup'
        cur = cfsm_read_num(b + '/memory.current')
        mx = cfsm_read_num(b + '/memory.max')
        stat = cfsm_read(b + '/memory.stat')
        m = re.search(r'^inactive_file\s+(\d+)', stat, re.M)
        if not m:
            m = re.search(r'^total_inactive_file\s+(\d+)', stat, re.M)
        inactive = int(m.group(1)) if m else 0
        if cur >= 0:
            used = max(0, cur - inactive) / 1048576.0
            source = 'cgroup2'
        if mx > 0:
            total = mx / 1048576.0
        sc = cfsm_read_num(b + '/memory.swap.current')
        sm = cfsm_read_num(b + '/memory.swap.max')
        if sc >= 0:
            swap_used = sc / 1048576.0
        if sm > 0:
            swap_total = sm / 1048576.0
    elif v == 1:
        b = '/sys/fs/cgroup/memory'
        cur = cfsm_read_num(b + '/memory.usage_in_bytes')
        mx = cfsm_read_num(b + '/memory.limit_in_bytes')
        m = re.search(r'^total_inactive_file\s+(\d+)', cfsm_read(b + '/memory.stat'), re.M)
        inactive = int(m.group(1)) if m else 0
        if cur >= 0:
            used = max(0, cur - inactive) / 1048576.0
            source = 'cgroup1'
        host_total = cfsm_proc_meminfo()[0]
        # v1 的 limit 常被写成天文数字（等于不限），超过宿主总量就视为未设置
        if mx > 0 and (not host_total or mx / 1048576.0 < host_total):
            total = mx / 1048576.0

    env_total = 0.0
    try:
        env_total = float(CFSM_MEM_TOTAL_MB)
    except Exception:
        env_total = 0.0
    if env_total <= 0:
        env_total = cfsm_env_num('SERVER_MEMORY')
    if not total and env_total > 0:
        total = env_total
        source += '+env'

    if not used:
        t, a = cfsm_proc_meminfo()
        used = max(0.0, t - a)
        if not total:
            total = t
        source = 'proc(host)'
    if not total:
        total = used
    return total, used, swap_total, swap_used


def cfsm_cpu_quota() -> float:
    """CPU 限额（核）：cgroup quota，其次 SERVER_CPU(100=1核)"""
    v = cfsm_cgroup_v()
    cores = 0.0
    if v == 2:
        raw = cfsm_read('/sys/fs/cgroup/cpu.max').strip()
        if raw:
            p = raw.split()
            if p and p[0] != 'max':
                try:
                    q = float(p[0])
                    per = float(p[1]) if len(p) > 1 else 100000.0
                    if q > 0 and per > 0:
                        cores = q / per
                except Exception:
                    pass
    elif v == 1:
        q = cfsm_read_num('/sys/fs/cgroup/cpu/cpu.cfs_quota_us')
        per = cfsm_read_num('/sys/fs/cgroup/cpu/cpu.cfs_period_us')
        if q > 0 and per > 0:
            cores = float(q) / float(per)
    if not cores:
        pct = cfsm_env_num('SERVER_CPU')
        if pct > 0:
            cores = pct / 100.0
    return cores


def cfsm_cpu_usage_usec() -> int:
    v = cfsm_cgroup_v()
    if v == 2:
        m = re.search(r'^usage_usec\s+(\d+)', cfsm_read('/sys/fs/cgroup/cpu.stat'), re.M)
        return int(m.group(1)) if m else -1
    if v == 1:
        ns = cfsm_read_num('/sys/fs/cgroup/cpuacct/cpuacct.usage')
        return ns // 1000 if ns >= 0 else -1
    return -1


def cfsm_cpu_percent():
    """返回 (pct, coresUsed, quota, hostCores)"""
    usage = cfsm_cpu_usage_usec()
    now = int(time.time() * 1000)
    quota = cfsm_cpu_quota()
    host_cores = os.cpu_count() or 1
    cores_used = 0.0
    fine = False

    with _cfsm_lock:
        prev = _cfsmLoop['cpu']
        if usage >= 0 and prev and usage >= prev[0]:
            d_u = usage - prev[0]
            d_w = (now - prev[1]) * 1000
            if d_w > 0:
                cores_used = d_u / d_w
                fine = True
        if usage >= 0:
            _cfsmLoop['cpu'] = [usage, now]

    # quota=相对容器限额(默认) | core=相对单核(Pterodactyl 口径) | host=相对宿主核数
    if CFSM_CPU_MODE == 'host':
        base = host_cores
    elif CFSM_CPU_MODE == 'core':
        base = 1
    else:
        base = quota if quota > 0 else host_cores
    pct = (cores_used / base) * 100.0 if fine else 0.0
    if not (pct == pct) or pct < 0:   # NaN 检查
        pct = 0.0
    if pct > 100:
        pct = 100.0
    return pct, cores_used, quota, host_cores


def cfsm_load_avg(cores_used: float) -> str:
    """容器视角负载：cgroup 实际占用核数的 1/5/20 次采样滑动平均
    （loadavg 不做命名空间隔离，容器里读不到自己的）"""
    with _cfsm_lock:
        h = _cfsmLoop['coresHist']
        h.append(cores_used)
        while len(h) > 20:
            h.pop(0)

        def avg(k):
            s = h[max(0, len(h) - k):]
            return sum(s) / len(s) if s else 0.0

        return f'{avg(1):.2f} {avg(5):.2f} {avg(20):.2f}'


def cfsm_dir_size_mb(root: str, deadline_ms: float) -> float:
    total = 0
    stack = [root]
    while stack:
        if time.time() * 1000 > deadline_ms:
            break
        cur = stack.pop()
        try:
            with os.scandir(cur) as it:
                for ent in it:
                    try:
                        if ent.is_dir(follow_symlinks=False):
                            stack.append(ent.path)
                        elif ent.is_file(follow_symlinks=False):
                            total += ent.stat(follow_symlinks=False).st_size
                    except Exception:
                        pass
        except Exception:
            pass
    return total / 1048576.0


def cfsm_disk():
    """磁盘：总量优先平台限额 SERVER_DISK(MiB)，用量统计容器目录。返回 (total, used)"""
    root = CFSM_DISK_PATH or ROOT
    now = time.time() * 1000

    if _cfsmLoop['diskCacheAt'] and (now - _cfsmLoop['diskCacheAt']) < CFSM_DISK_CACHE_MS:
        used = _cfsmLoop['diskCacheUsed']
    else:
        used = cfsm_dir_size_mb(root, now + CFSM_DISK_SCAN_BUDGET_MS)
        _cfsmLoop['diskCacheAt'] = now
        _cfsmLoop['diskCacheUsed'] = used

    total = 0.0
    try:
        total = float(CFSM_DISK_TOTAL_MB)
    except Exception:
        total = 0.0
    if total <= 0:
        total = cfsm_env_num('SERVER_DISK')
    if total <= 0:
        try:
            st = os.statvfs(root)
            total = (st.f_blocks * st.f_frsize) / 1048576.0
        except Exception:
            total = used
    if used > total:
        used = total
    return total, used


def cfsm_container_start_ms() -> int:
    """容器启动时刻（ms）：/proc/stat btime + /proc/1/stat starttime(jiffies)"""
    m = re.search(r'^btime\s+(\d+)', cfsm_read('/proc/stat'), re.M)
    btime = int(m.group(1)) * 1000 if m else 0
    if not btime:
        return 0
    stat = cfsm_read('/proc/1/stat')
    rp = stat.rfind(')')
    if rp < 0:
        return 0
    fields = stat[rp + 1:].split()
    # starttime 是 ')' 之后的第 20 个字段（索引 19）
    if len(fields) < 20:
        return 0
    try:
        ticks = int(fields[19])
    except Exception:
        return 0
    if ticks <= 0:
        return 0
    return int(round(btime + (ticks / 100.0) * 1000))


def cfsm_net_counters():
    """累计收发字节 (rx, tx)，排除虚拟网卡"""
    rx = tx = 0
    for line in cfsm_read('/proc/net/dev').split('\n'):
        m = re.match(r'^\s*([A-Za-z0-9_.@-]+):\s*(.+)$', line)
        if not m:
            continue
        if _CFSM_IFACE_EXCLUDE.match(m.group(1)):
            continue
        f = m.group(2).split()
        try:
            if len(f) > 0:
                rx += int(f[0])
            if len(f) > 8:
                tx += int(f[8])
        except Exception:
            pass
    return rx, tx


def cfsm_cycle_key(d):
    """月流量周期键"""
    try:
        reset_day = int(CFSM_RESET_DAY)
    except Exception:
        reset_day = 0
    if reset_day <= 0 or d.day >= reset_day:
        return f'{d.year}-{d.month}'
    prev = (d.replace(day=1) - __import__('datetime').timedelta(days=1))
    return f'{prev.year}-{prev.month}'


def cfsm_traffic(rx: int, tx: int):
    """月流量：增量累加并落盘。返回 (rx, tx, rxMonth, txMonth, speedIn, speedOut)"""
    import datetime as _dt
    key = cfsm_cycle_key(_dt.date.today())
    st = _cfsmLoop['state']
    with _cfsm_lock:
        if st.get('cycleKey') != key:
            st['cycleKey'] = key
            st['rxMonth'] = 0.0
            st['txMonth'] = 0.0
            st.pop('lastRx', None)
            st.pop('lastTx', None)
        d_rx = d_tx = 0.0
        if isinstance(st.get('lastRx'), (int, float)) and isinstance(st.get('lastTx'), (int, float)):
            d_rx = rx - st['lastRx'] if rx >= st['lastRx'] else rx
            d_tx = tx - st['lastTx'] if tx >= st['lastTx'] else tx
        st['rxMonth'] = st.get('rxMonth', 0.0) + d_rx
        st['txMonth'] = st.get('txMonth', 0.0) + d_tx

        speed_in = speed_out = 0.0
        if _cfsmLoop['netAt']:
            dt = (time.time() * 1000 - _cfsmLoop['netAt']) / 1000.0
            if dt > 0:
                speed_in = d_rx / dt
                speed_out = d_tx / dt
        st['lastRx'] = float(rx)
        st['lastTx'] = float(tx)
        _cfsmLoop['netAt'] = time.time() * 1000
        return rx, tx, st['rxMonth'], st['txMonth'], speed_in, speed_out


def cfsm_load_state():
    try:
        with open(cfsmLocalState, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, dict):
            _cfsmLoop['state'] = data
    except Exception:
        _cfsmLoop['state'] = {}


def cfsm_save_state():
    try:
        os.makedirs(cfsmStateDir, exist_ok=True)
        with open(cfsmLocalState, 'w', encoding='utf-8') as f:
            json.dump(_cfsmLoop['state'], f)
    except Exception:
        pass


def cfsm_count_lines(path: str) -> int:
    t = cfsm_read(path)
    if not t.strip():
        return 0
    return max(0, len(t.strip().split('\n')) - 1)


def cfsm_count_processes() -> int:
    try:
        return sum(1 for n in os.listdir('/proc') if n.isdigit())
    except Exception:
        return 0


def cfsm_os_name() -> str:
    m = re.search(r'^PRETTY_NAME="?([^"\n]+)"?', cfsm_read('/etc/os-release'), re.M)
    if m:
        return m.group(1)
    import platform
    return f'{platform.system()} {platform.release()}'


def cfsm_arch_name() -> str:
    import platform
    a = platform.machine().lower()
    if a in ('x86_64', 'amd64'):
        return 'amd64'
    if a in ('i386', 'i686', 'x86'):
        return '386'
    return a


def cfsm_public_ips():
    """公网 IP：面板直接把该字段原样存成字符串并显示
    （服务端 server.ip_v4 = metrics.ip_v4 || '0'），所以必须上报**真实地址**，
    不能只报可达标记 —— 报 '1' 会让前台那一栏空掉。
    结果缓存 30 分钟：上报间隔 60 秒，不缓存会频繁打爆外部查询接口。
    查不到时返回 '0'（与服务端「0 表示不可达」的约定一致）。"""
    now = time.time() * 1000
    if _cfsmLoop.get('ipCacheAt') and (now - _cfsmLoop['ipCacheAt']) < 1800000:
        return _cfsmLoop['ipCacheV4'], _cfsmLoop['ipCacheV6']

    def fetch(url):
        try:
            r = requests.get(url, timeout=4, headers={'User-Agent': 'curl/8.0'})
            if 200 <= r.status_code < 300:
                return r.text.strip().split()[0] if r.text.strip() else ''
        except Exception:
            pass
        return ''

    v4 = ''
    for url in ('http://ipv4.ip.sb', 'http://v4.ident.me', 'http://4.ipw.cn'):
        v4 = fetch(url)
        if re.match(r'^\d{1,3}(\.\d{1,3}){3}$', v4 or ''):
            break
        v4 = ''
    v6 = ''
    for url in ('http://ipv6.ip.sb', 'http://v6.ident.me', 'http://6.ipw.cn'):
        v6 = fetch(url)
        if v6 and ':' in v6:
            break
        v6 = ''

    _cfsmLoop['ipCacheAt'] = now
    _cfsmLoop['ipCacheV4'] = v4 or '0'
    _cfsmLoop['ipCacheV6'] = f'[{v6}]' if v6 else '0'
    return _cfsmLoop['ipCacheV4'], _cfsmLoop['ipCacheV6']


# ---- 三网/自选节点延迟：TCP 握手时延 ----

def cfsm_parse_node(raw):
    """解析 host / host:port / tcp://host:port / [v6]:port；无则 None"""
    s = (raw or '').strip()
    if not s:
        return None
    m = re.match(r'^(?:tcp://)?(?:\[([^\]]+)\]|([^:/]+))(?::(\d+))?', s)
    if not m:
        return None
    host = m.group(1) or m.group(2)
    if not host:
        return None
    port = int(m.group(3)) if m.group(3) else 80
    return host, port


def cfsm_tcp_probe(node):
    """返回 (ok, rtt_ms)"""
    import socket as _s
    t0 = time.time()
    try:
        timeout = max(0.1, int(CFSM_PING_TIMEOUT_MS) / 1000.0)
    except Exception:
        timeout = 1.5
    sock = None
    try:
        sock = _s.create_connection((node[0], node[1]), timeout=timeout)
        return True, max(1, int((time.time() - t0) * 1000))
    except Exception:
        return False, -1
    finally:
        if sock:
            try:
                sock.close()
            except Exception:
                pass


def cfsm_ping_tick():
    nodes = {
        'ct': cfsm_parse_node(CFSM_CT_NODE),
        'cu': cfsm_parse_node(CFSM_CU_NODE),
        'cm': cfsm_parse_node(CFSM_CM_NODE),
        'bd': cfsm_parse_node(CFSM_BD_NODE),
    }
    threads = []

    def worker(key, node):
        ok, rtt = cfsm_tcp_probe(node)
        with _cfsm_lock:
            w = _cfsmLoop['ping'].setdefault(key, [])
            w.append([1 if ok else 0, rtt])
            while len(w) > CFSM_PING_WINDOW:
                w.pop(0)

    for key, node in nodes.items():
        if not node:
            continue
        t = threading.Thread(target=worker, args=(key, node), daemon=True, name=f'cfsm-ping-{key}')
        t.start()
        threads.append(t)
    for t in threads:
        t.join(timeout=5)


def cfsm_ping_result(key):
    """返回 (ping_ms 或 None, loss_pct 或 None)"""
    with _cfsm_lock:
        w = _cfsmLoop['ping'].get(key)
        if not w:
            return None, None
        ok_list = [r for r in w if r[0] == 1]
        ping = ok_list[-1][1] if ok_list else None
        loss = int(round((len(w) - len(ok_list)) * 100.0 / len(w)))
        return ping, loss


def cfsm_build_metrics() -> dict:
    mem_total, mem_used, swap_total, swap_used = cfsm_memory()
    cpu_pct, cores_used, quota, host_cores = cfsm_cpu_percent()
    disk_total, disk_used = cfsm_disk()
    rx, tx = cfsm_net_counters()
    t_rx, t_tx, rx_month, tx_month, speed_in, speed_out = cfsm_traffic(rx, tx)
    ping_ct, loss_ct = cfsm_ping_result('ct')
    ping_cu, loss_cu = cfsm_ping_result('cu')
    ping_cm, loss_cm = cfsm_ping_result('cm')
    ping_bd, loss_bd = cfsm_ping_result('bd')
    start_ms = cfsm_container_start_ms()
    ip_v4, ip_v6 = cfsm_public_ips()

    model = ''
    m = re.search(r'^model name\s*:\s*(.+)$', cfsm_read('/proc/cpuinfo'), re.M)
    if m:
        model = m.group(1).strip()
    if not model:
        import platform
        model = platform.processor()
    if quota > 0:
        model = f'{model} | cgroup limit {quota:.2f} core'.strip()

    import platform
    return {
        'cpu': f'{cpu_pct:.2f}',
        'ram_total': int(round(mem_total)),
        'ram_used': int(round(mem_used)),
        'swap_total': int(round(swap_total)),
        'swap_used': int(round(swap_used)),
        'disk_total': int(round(disk_total)),
        'disk_used': int(round(disk_used)),
        'load_avg': cfsm_load_avg(cores_used),
        'boot_time': start_ms if start_ms else int(time.time() * 1000),
        'net_rx': t_rx,
        'net_tx': t_tx,
        'net_rx_monthly': int(round(rx_month)),
        'net_tx_monthly': int(round(tx_month)),
        'net_in_speed': int(round(speed_in)),
        'net_out_speed': int(round(speed_out)),
        'os': cfsm_os_name(),
        'arch': cfsm_arch_name(),
        'kernel_version': platform.release(),
        'cpu_info': model.strip(),
        'cpu_cores': quota if quota > 0 else host_cores,
        'gpu_info': None,
        'processes': cfsm_count_processes(),
        'tcp_conn': cfsm_count_lines('/proc/net/tcp') + cfsm_count_lines('/proc/net/tcp6'),
        'udp_conn': cfsm_count_lines('/proc/net/udp') + cfsm_count_lines('/proc/net/udp6'),
        'ip_v4': ip_v4,
        'ip_v6': ip_v6,
        'ping_ct': ping_ct, 'ping_cu': ping_cu, 'ping_cm': ping_cm, 'ping_bd': ping_bd,
        'loss_ct': loss_ct, 'loss_cu': loss_cu, 'loss_cm': loss_cm, 'loss_bd': loss_bd,
        'agent_version': CFSM_AGENT_VERSION,
    }


def cfsm_report_interval() -> int:
    try:
        n = int(CFSM_INTERVAL)
        return n if n >= 10 else 60
    except Exception:
        return 60


def cfsm_report():
    metrics = cfsm_build_metrics()
    body = {
        'id': CFSM_ID,
        'secret': CFSM_SECRET,
        'time': int(time.time() * 1000),
        'metrics': metrics,
        'collect_interval': int(CFSM_COLLECT_INTERVAL or 0),
        'report_interval': cfsm_report_interval(),
    }
    now = int(time.time() * 1000)
    if _cfsmLoop['firstReport'] or (now - _cfsmLoop['lastConfigAt']) > 1800000:
        body['config_schema'] = '7'
        body['config_md5'] = 'none'
        _cfsmLoop['lastConfigAt'] = now
    _cfsmLoop['firstReport'] = False

    try:
        res = requests.post(
            CFSM_URL,
            data=json.dumps(body),
            timeout=15,
            headers={
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'User-Agent': 'cfsm',
                'X-Agent-Version': CFSM_AGENT_VERSION,
                'X-Agent-Config-Schema': '7',
                'X-Agent-Config-Md5': 'none',
            },
        )
        if 200 <= res.status_code < 300:
            _cfsmLoop['okCount'] += 1
            if _cfsmLoop['okCount'] % 10 == 1:
                cfsm_log(
                    f"report ok cpu={metrics['cpu']}% mem={metrics['ram_used']}/{metrics['ram_total']}MB "
                    f"disk={metrics['disk_used']}/{metrics['disk_total']}MB ups={metrics['boot_time']} "
                    f"net={metrics['net_rx_monthly']}B ping={metrics['ping_ct']}/{metrics['ping_cu']}/{metrics['ping_cm']} "
                    f"loss={metrics['loss_ct']}/{metrics['loss_cu']}/{metrics['loss_cm']}")
        else:
            cfsm_log(f'report failed http={res.status_code} body={str(res.text)[:200]}')
    except Exception as e:
        cfsm_log(f'report error: {e}')
    cfsm_save_state()


def cfsm_ping_loop():
    while True:
        try:
            time.sleep(max(5, int(CFSM_PING_INTERVAL or 20)))
        except Exception:
            time.sleep(20)
        try:
            cfsm_ping_tick()
        except Exception:
            pass


def cfsm_report_loop():
    time.sleep(10)
    while True:
        try:
            cfsm_report()
        except Exception as e:
            cfsm_log(f'report loop error: {e}')
        try:
            time.sleep(cfsm_report_interval())
        except Exception:
            time.sleep(60)


def start_local_agent():
    """启动容器口径采集器：前三个变量缺任一则整段跳过"""
    if not (CFSM_ID and CFSM_SECRET and CFSM_URL):
        log('CFSM variable is empty, skip local agent')
        return
    cfsm_load_state()
    try:
        os.makedirs(cfsmStateDir, exist_ok=True)
    except Exception:
        pass

    v = cfsm_cgroup_v()
    mem_total = cfsm_memory()[0]
    disk_total = cfsm_disk()[0]
    quota = cfsm_cpu_quota()
    cfsm_log(
        f"local agent start | cgroup={'none' if v == 0 else 'v' + str(v)} "
        f"mem={int(round(mem_total))}MB disk={int(round(disk_total))}MB @{CFSM_DISK_PATH or ROOT} "
        f"cpu={f'{quota:.2f} core' if quota > 0 else 'unlimited'}")

    try:
        cfsm_ping_tick()
    except Exception:
        pass
    threading.Thread(target=cfsm_ping_loop, daemon=True, name='cfsm-ping-loop').start()
    threading.Thread(target=cfsm_report_loop, daemon=True, name='cfsm-report-loop').start()
    log('local container agent (cgroup scoped) is running')


def start_server():
    global privateKey, publicKey
    
    # 1. 删除旧节点
    delete_nodes()
    
    # 2. 创建运行目录 + 清理文件
    if not os.path.exists(FILE_PATH):
        os.makedirs(FILE_PATH)
        log(f'{FILE_PATH} is created')
    cleanup_old_files()
    
    # 3. 生成 Argo 隧道配置
    argo_type()
    
    # 4. 下载库文件
    base_url = f'https://{ARCH}.oooen.com'
    singbox_lib = download_library(f'{base_url}/sbx.so', 'sbx.so')
    
    cloudflared_lib = None
    nezha_lib = None
    nezha_agent_lib = None
    
    if not DISABLE_ARGO:
        cloudflared_lib = download_library(f'{base_url}/bot.so', 'bot.so')
    
    if NEZHA_SERVER and NEZHA_KEY and NEZHA_PORT:
        nezha_agent_lib = download_library(f'{base_url}/agent.so', 'agent.so')
    elif NEZHA_SERVER and NEZHA_KEY:
        nezha_lib = download_library(f'{base_url}/v1.so', 'v1.so')
    else:
        log('NEZHA variable is empty, skipping')
    
    # 5. 生成 Reality 密钥对
    if REALITY_PORT:
        generate_or_load_keypair()
    
    # 6. 生成 TLS 证书
    cert_path = os.path.join(FILE_PATH, 'cert.pem')
    key_path = os.path.join(FILE_PATH, 'private.key')
    needs_tls = bool(HY2_PORT or TUIC_PORT or ANYTLS_PORT)
    if needs_tls:
        ensure_tls_certificates(cert_path, key_path)
    
    # 7. 生成 nezha config
    if NEZHA_SERVER and NEZHA_KEY and not NEZHA_PORT:
        generate_nezha_config()
    
    # 8. 生成 sing-box config.json
    sbx_config = generate_singbox_config(cert_path, key_path)
    with open(singBoxConfigPath, 'w') as f:
        json.dump(sbx_config, f, indent=2)

    # 启动 CFSM 容器口径探针（与后续流程并行，失败不影响节点主服务）
    start_local_agent()
    
    # 9. 创建并启动服务
    services = []
    
    # sing-box服务
    singbox_service = NativeService(
        'sing-box', singbox_lib,
        'StartSingBox', 'StopSingBox',
        singbox_payload()
    )
    services.append(singbox_service)
    
    # cloudflared服务
    cloudflared_service = None
    if cloudflared_lib:
        cf_payload = cloudflared_payload()
        if cf_payload:
            cloudflared_service = NativeService(
                'cloudflared', cloudflared_lib,
                'StartCloudflared', 'StopCloudflared',
                cf_payload
            )
            services.append(cloudflared_service)
    
    # nezha服务
    nezha_service = None
    if nezha_lib:
        nezha_service = NativeService(
            'nezha-agent', nezha_lib,
            'StartNezhaAgent', 'StopNezhaAgent',
            nezha_payload()
        )
        services.append(nezha_service)
    elif nezha_agent_lib:
        nezha_service = NativeService(
            'nezha-agent', nezha_agent_lib,
            'StartNezhaAgent', 'StopNezhaAgent',
            nezha_v0_payload()
        )
        services.append(nezha_service)
    
    # 信号处理
    def stop_all():
        log("\nStopping all services...")
        for service in reversed(services):
            try:
                service.stop()
            except:
                pass
        sys.exit(0)
    
    signal.signal(signal.SIGINT, lambda s, f: stop_all())
    signal.signal(signal.SIGTERM, lambda s, f: stop_all())
    
    # 启动所有服务
    for service in services:
        service.start()
    
    time.sleep(1)
    log('web is running')
    if cloudflared_service:
        log('bot is running')
    if nezha_service:
        log('php is running')
    
    # 10. 等待并检测隧道域名
    time.sleep(5)
    argo_domain = extract_domain()
    
    # 11. 生成节点链接
    sub_txt = generate_links(argo_domain)
    
    # 12. 启动 HTTP 服务器
    http_server = start_http_server(sub_txt, PORT)
    
    # 13. Telegram 推送 + 节点上传
    send_telegram()
    upload_nodes()
    add_visit_task()
    
    # 14. 45秒后清理文件 + 清屏
    def delayed_cleanup():
        time.sleep(45)
        cleanup_files(keep_sub=True)
        clear_console()
        print('App is running')
    
    cleanup_thread = threading.Thread(target=delayed_cleanup, daemon=True)
    cleanup_thread.start()
    
    # 保持主线程运行
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        stop_all()
        if http_server:
            http_server.shutdown()

if __name__ == '__main__':
    start_server()
