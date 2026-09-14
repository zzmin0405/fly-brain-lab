"""게임 틱마다 현재 관측을 받아 모델 행동을 반환하는 로컬 추론 API."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import numpy as np
import torch
from defense import Defense
from train import BrainPolicy, load_graph

SESSIONS = {}
ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get('FLY_BRAIN_SOURCE', ROOT.parent / 'drosophila-brain-reference'))
CHECKPOINT = Path(os.environ.get('FLY_BRAIN_CHECKPOINT', ROOT / 'brain/artifacts/run-001/checkpoint.pt'))
MODEL = None
MODEL_ERROR = None
try:
    graph, _ = load_graph(SOURCE)
    MODEL = BrainPolicy(graph)
    MODEL.load_state_dict(torch.load(CHECKPOINT, map_location='cpu', weights_only=True)['state_dict'])
    MODEL.eval()
except Exception as exc:  # API는 실행되지만 상태에 명시적으로 오류를 반환한다.
    MODEL_ERROR = str(exc)

class Handler(BaseHTTPRequestHandler):
    def _json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type', 'application/json'); self.send_header('Access-Control-Allow-Origin', 'http://127.0.0.1:5173'); self.send_header('Access-Control-Allow-Headers', 'Content-Type'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_OPTIONS(self):
        self.send_response(204); self.send_header('Access-Control-Allow-Origin', 'http://127.0.0.1:5173'); self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); self.send_header('Access-Control-Allow-Headers', 'Content-Type'); self.end_headers()
    def do_GET(self):
        if self.path == '/health': self._json({'ok': MODEL is not None, 'engine': 'fly-brain-live', 'mode': 'flywire-checkpoint' if MODEL else 'unavailable', 'error': MODEL_ERROR}); return
        self._json({'error': '찾을 수 없습니다.'}, 404)
    def do_POST(self):
        size = int(self.headers.get('Content-Length', 0)); data = json.loads(self.rfile.read(size) or '{}')
        session = str(data.get('session', 'default'))
        if self.path == '/reset': SESSIONS[session] = Defense(int(data.get('seed', 2000))); self._json(SESSIONS[session].snapshot()); return
        if self.path != '/step': self._json({'error': '찾을 수 없습니다.'}, 404); return
        env = SESSIONS.setdefault(session, Defense(int(data.get('seed', 2000))))
        if env.done: self._json({'state': env.snapshot(), 'action': 0, 'done': True}); return
        if MODEL is None:
            self._json({'error': 'FlyWire 체크포인트를 로드하지 못했습니다.', 'detail': MODEL_ERROR}, 503); return
        with torch.no_grad():
            observation = torch.from_numpy(env.observe())[None]
            logits = MODEL(observation)[0].masked_fill(~torch.from_numpy(env.mask()), -1e9)
            action = int(logits.argmax())
        env.step(action)
        self._json({'state': env.snapshot(), 'action': action, 'done': env.done})
    def log_message(self, *_): return

if __name__ == '__main__':
    port = int(os.environ.get('BRAIN_API_PORT', '8787'))
    print(f'실시간 추론 API: http://127.0.0.1:{port}')
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
