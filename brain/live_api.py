"""게임 틱마다 현재 관측을 받아 모델 행동을 반환하는 로컬 추론 API."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from defense import Defense

SESSIONS = {}

class Handler(BaseHTTPRequestHandler):
    def _json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path == '/health': self._json({'ok': True, 'engine': 'fly-brain-live', 'mode': 'teacher-fallback'}); return
        self._json({'error': '찾을 수 없습니다.'}, 404)
    def do_POST(self):
        size = int(self.headers.get('Content-Length', 0)); data = json.loads(self.rfile.read(size) or '{}')
        session = str(data.get('session', 'default'))
        if self.path == '/reset': SESSIONS[session] = Defense(int(data.get('seed', 2000))); self._json(SESSIONS[session].snapshot()); return
        if self.path != '/step': self._json({'error': '찾을 수 없습니다.'}, 404); return
        env = SESSIONS.setdefault(session, Defense(int(data.get('seed', 2000))))
        if env.done: self._json({'state': env.snapshot(), 'action': 0, 'done': True}); return
        action = env.teacher()  # 모델 어댑터를 연결하면 이 한 줄을 모델 추론으로 교체한다.
        env.step(action)
        self._json({'state': env.snapshot(), 'action': action, 'done': env.done})
    def log_message(self, *_): return

if __name__ == '__main__':
    port = int(os.environ.get('BRAIN_API_PORT', '8787'))
    print(f'실시간 추론 API: http://127.0.0.1:{port}')
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
