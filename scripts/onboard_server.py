#!/usr/bin/env python3
"""
onboard_server.py

Tiny Flask app to present a simple form and create a new client deployment.
Run as root on the VPS (this script will write systemd and nginx configs, create folders,
and enable services). Use only on trusted hosts.

Usage:
  sudo python3 scripts/onboard_server.py --host 127.0.0.1 --port 8080

"""
import os
import sys
import argparse
import shutil
import subprocess
from pathlib import Path
from flask import Flask, request, render_template_string

APP = Flask(__name__)

TEMPLATE_PATH = Path(__file__).parent / 'templates' / 'onboard_form.html'
TEMPLATE_HTML = TEMPLATE_PATH.read_text() if TEMPLATE_PATH.exists() else """
<html><body><h1>Missing template</h1></body></html>
"""

BASE_DIR = Path('/opt/bizcalc')
BIN_PATH = BASE_DIR / 'bin' / 'bizcalc-server'
FRONTEND_DIST = BASE_DIR / 'frontend'
CLIENTS_DIR = BASE_DIR / 'clients'

def find_free_port(start=3001, end=3999):
    import socket
    for p in range(start, end+1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', p))
                return p
            except OSError:
                continue
    raise RuntimeError('no free ports')

def run(cmd):
    print('RUN:', cmd)
    subprocess.check_call(cmd, shell=True)

def create_client(client: str, subdomain: str, port: int | None):
    # validate
    if not client or not client.replace('-', '').isalnum():
        raise ValueError('invalid client name')
    if not BIN_PATH.exists():
        raise FileNotFoundError(f'backend binary not found at {BIN_PATH}')
    if not FRONTEND_DIST.exists():
        raise FileNotFoundError(f'frontend dist not found at {FRONTEND_DIST}')

    client_dir = CLIENTS_DIR / client
    frontend_target = client_dir / 'frontend'
    data_dir = client_dir / 'data'
    uploads_dir = client_dir / 'uploads'
    os.makedirs(frontend_target, exist_ok=True)
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(uploads_dir, exist_ok=True)

    # copy frontend
    if frontend_target.exists():
        shutil.rmtree(frontend_target)
    shutil.copytree(FRONTEND_DIST, frontend_target)

    # port
    if port is None or port == 0:
        port = find_free_port()

    # systemd unit
    svc_name = f'bizcalc-client-{client}'
    svc_path = Path('/etc/systemd/system') / f'{svc_name}.service'
    unit = f'''[Unit]
Description=BizCalc API (client: {client})
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory={client_dir}
Environment=PORT={port}
ExecStart={BIN_PATH}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
'''
    svc_path.write_text(unit)
    run('systemctl daemon-reload')
    run(f'systemctl enable --now {svc_name}.service')

    # nginx config (sites-available + symlink)
    sites_avail = Path('/etc/nginx/sites-available')
    sites_enabled = Path('/etc/nginx/sites-enabled')
    sites_avail.mkdir(parents=True, exist_ok=True)
    sites_enabled.mkdir(parents=True, exist_ok=True)

    nginx_conf = f'''
server {{
    listen 80;
    server_name {subdomain};
    root {frontend_target};
    index index.html;

    location /api/ {{
        proxy_pass http://127.0.0.1:{port}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    location / {{
        try_files $uri $uri/ /index.html;
    }}
}}
'''
    conf_path = sites_avail / f'bizcalc-{client}.conf'
    conf_path.write_text(nginx_conf)
    symlink = sites_enabled / conf_path.name
    if symlink.exists():
        symlink.unlink()
    symlink.symlink_to(conf_path)

    run('nginx -t')
    run('systemctl reload nginx')

    return {'client': client, 'subdomain': subdomain, 'port': port}

@APP.route('/', methods=['GET'])
def index():
    return render_template_string(TEMPLATE_HTML)

@APP.route('/create', methods=['POST'])
def create():
    client = request.form.get('client')
    subdomain = request.form.get('subdomain')
    port_str = request.form.get('port', '').strip()
    port = int(port_str) if port_str else None
    try:
        result = create_client(client, subdomain, port)
        return f"Client created: {result}", 200
    except Exception as e:
        return f"Error: {e}", 500

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8080)
    args = parser.parse_args()
    if os.geteuid() != 0:
        print('Warning: this server performs privileged ops; run as root (sudo).')
    APP.run(host=args.host, port=args.port)

if __name__ == '__main__':
    main()
