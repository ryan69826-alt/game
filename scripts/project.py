#!/usr/bin/env python3
"""Dependency-free Linux setup, SugarCube build, and auto-reloading preview."""
import argparse
import base64
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
from pathlib import Path
import platform
import re
import subprocess
import threading
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / '.tools'
DIST = ROOT / 'dist'
ASSETS = ROOT / 'assets'
DOWNLOADS = [
    ('https://github.com/tmedwards/tweego/releases/download/v2.1.1/tweego-2.1.1-linux-x64.zip',
     '2ed11c3aa66c88ec5382b51061c7782152632b88916777428ab57a66feb7e5aa', TOOLS),
    ('https://github.com/tmedwards/sugarcube-2/releases/download/v2.37.3/sugarcube-2.37.3-for-twine-2.1-local.zip',
     'da00a8c15ec4e88a9e231a3ff6c516c57055f84231bb999f869ed34ade353dab', TOOLS / 'storyformats'),
]


def setup():
    if platform.system() != 'Linux' or platform.machine() not in ('x86_64', 'AMD64'):
        raise SystemExit('Automated setup supports Linux x64. See README for native Tweego builds.')
    for url, expected, target in DOWNLOADS:
        print('Installing', url.rsplit('/', 1)[-1], flush=True)
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise SystemExit('Download checksum mismatch; no archive was installed.')
        target.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            archive.extractall(target)
    (TOOLS / 'tweego').chmod(0o755)
    build()


def build(compiler=None):
    DIST.mkdir(exist_ok=True)
    compiler = Path(compiler).resolve() if compiler else TOOLS / 'tweego'
    if not compiler.exists():
        raise SystemExit('Run python3 scripts/project.py setup first.')
    # Write a temporary file so a failed compilation preserves the last good build.
    target = DIST / 'building.html'
    subprocess.run([str(compiler), '-f', 'sugarcube-2', '-o', str(target), 'src'],
                   cwd=ROOT, check=True)
    # Embed local artwork so the downloadable game remains a single offline file.
    def embed(match):
        asset = (ASSETS / match.group(1)).resolve()
        if not asset.is_relative_to(ASSETS.resolve()):
            raise ValueError('Asset path must stay inside assets/')
        return 'data:image/png;base64,' + base64.b64encode(asset.read_bytes()).decode('ascii')

    html = re.sub(r'asset:([A-Za-z0-9_./-]+\.png)', embed, target.read_text())
    target.write_text(html)
    target.replace(DIST / 'index.html')
    # Named standalone entry for browser delivery, alongside the dev-server index.
    (DIST / 'Neon-Meridian.html').write_bytes((DIST / 'index.html').read_bytes())
    print('Built dist/index.html and dist/Neon-Meridian.html', flush=True)



def revision():
    digest = hashlib.sha256()
    for path in sorted([*(ROOT / 'src').rglob('*'), *ASSETS.rglob('*')]):
        if path.is_file():
            digest.update(str(path.relative_to(ROOT)).encode())
            digest.update(path.read_bytes())
    return digest.hexdigest()


def serve(host, port):
    build()
    lock = threading.Lock()
    state = {'revision': revision()}

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(DIST), **kwargs)

        def do_GET(self):
            if self.path == '/__revision':
                with lock:
                    current = revision()
                    if current != state['revision']:
                        try:
                            build()
                        except (subprocess.CalledProcessError, OSError, ValueError):
                            self.send_error(500, 'Build failed. Check the preview terminal.')
                            return
                        state['revision'] = current
                self.send_response(200)
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(state['revision'].encode())
            elif self.path in ('/', '/index.html'):
                page = (DIST / 'index.html').read_text()
                script = '''<script>
                let revision = INITIAL;
                setInterval(async () => {
                  try {
                    const response = await fetch('/__revision', {cache: 'no-store'});
                    if (!response.ok) return;
                    const next = await response.text();
                    if (revision !== next) location.reload();
                  } catch (_) { /* Retry after a temporary disconnect. */ }
                }, 1000);
                </script>'''.replace('INITIAL', repr(state['revision']))
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(page.replace('</body>', script + '</body>').encode())
            else:
                super().do_GET()

    print(f'Preview listening on {host}:{port}. Ctrl+C to stop.', flush=True)
    with ThreadingHTTPServer((host, port), Handler) as server:
        server.serve_forever()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['setup', 'build', 'dev'])
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--tweego', help='Native Tweego executable path (build command only)')
    args = parser.parse_args()
    if args.command == 'setup':
        setup()
    elif args.command == 'build':
        build(args.tweego)
    else:
        serve(args.host, args.port)
