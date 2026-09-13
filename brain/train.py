"""전체 v783 그래프를 보존한 게임용 rate 모델 학습. Shiu LIF 재현이 아니다."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import time
import numpy as np
import pandas as pd
import torch
from torch import nn
from defense import Defense, OBSERVATIONS, ACTIONS


class BrainPolicy(nn.Module):
    def __init__(self, graph, seed=42):
        super().__init__()
        torch.manual_seed(seed)
        self.register_buffer('graph', graph, persistent=False)
        n = graph.shape[0]
        # 인공 감각 인코더와 출력 디코더. 해부학적 감각/운동 뉴런 매핑이 아니다.
        self.encoder = nn.Linear(OBSERVATIONS, n)
        self.gain = nn.Parameter(torch.zeros(n))
        self.bias = nn.Parameter(torch.zeros(n))
        self.decoder = nn.Linear(n, ACTIONS)

    def forward(self, observations):
        signal = self.encoder(observations).T
        state = torch.tanh(signal)
        for _ in range(3):
            # 뉴런별 양수 gain으로 모든 기존 연결의 부호와 topology를 보존한다.
            state = torch.tanh(signal + self.bias[:, None] +
                               torch.sparse.mm(self.graph, state * self.gain.exp()[:, None]))
        return self.decoder(state.T)


def load_graph(source):
    nodes_path, edges_path = source / 'Completeness_783.csv', source / 'Connectivity_783.parquet'
    nodes = pd.read_csv(nodes_path, index_col=0)
    edges = pd.read_parquet(edges_path)
    n = len(nodes)
    pre = edges['Presynaptic_Index'].to_numpy(dtype=np.int64)
    post = edges['Postsynaptic_Index'].to_numpy(dtype=np.int64)
    weights = edges['Excitatory x Connectivity'].to_numpy(dtype=np.float32)
    assert min(pre.min(), post.min()) >= 0 and max(pre.max(), post.max()) < n
    assert np.isfinite(weights).all()
    normalization = np.bincount(post, weights=np.abs(weights), minlength=n).clip(1)
    values = torch.from_numpy((weights / normalization[post]).astype(np.float32))
    graph = torch.sparse_coo_tensor(torch.from_numpy(np.stack([post, pre])), values, (n, n)).coalesce()
    manifest = {'dataset': 'FlyWire v783 / Shiu model distribution', 'nodes': n,
                'source_rows': len(edges), 'coalesced_edges': graph._nnz(), 'zero_weight_rows': int((weights == 0).sum()),
                'source_repo': 'https://github.com/philshiu/Drosophila_brain_model',
                'source_commit': subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip(),
                'files': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [nodes_path, edges_path]},
                'model': '3-step rate graph; trainable neuron gains + artificial encoder/decoder; NOT Shiu LIF',
                'data_license': 'FlyWire CC BY-NC 4.0; upstream code MIT'}
    return graph.to_sparse_csr(), manifest


def expert_data(seeds):
    observations, actions, masks = [], [], []
    for seed in seeds:
        env = Defense(seed)
        while not env.done:
            observations.append(env.observe()); masks.append(env.mask())
            action = env.teacher(); actions.append(action); env.step(action)
    return torch.from_numpy(np.stack(observations)), torch.tensor(actions), torch.from_numpy(np.stack(masks))


def evaluate(model, seeds, device):
    scores, replay = [], []
    with torch.no_grad():
        for seed in seeds:
            env = Defense(seed)
            frames = [env.snapshot()]
            while not env.done:
                logits = model(torch.from_numpy(env.observe()).to(device)[None])[0]
                logits = logits.masked_fill(~torch.from_numpy(env.mask()).to(device), -1e9)
                action = int(logits.argmax())
                env.step(action)
                frames.append({**env.snapshot(), 'action': action})
            scores.append(env.score())
            if not replay:
                replay = frames
    return {'scores': scores, 'mean_score': float(np.mean(scores))}, replay


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('brain/artifacts/run-001'))
    parser.add_argument('--steps', type=int, default=40)
    parser.add_argument('--batch', type=int, default=8)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit('기존 결과를 보존합니다. 새 --output 경로를 지정하세요.')
    args.output.mkdir(parents=True)
    torch.set_num_threads(8)
    torch.manual_seed(42)
    started = time.time()
    graph, manifest = load_graph(args.source)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(json.dumps({**manifest, 'device': str(device)}, ensure_ascii=False), flush=True)
    model = BrainPolicy(graph).to(device)
    before_gain = model.gain.detach().clone()
    observations, targets, masks = expert_data(range(20))
    validation, validation_targets, validation_masks = expert_data(range(1000, 1002))
    before, _ = evaluate(model, [2000], device)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.0003)
    history = []
    for step in range(args.steps):
        indices = torch.randint(len(targets), (args.batch,))
        logits = model(observations[indices].to(device)).masked_fill(~masks[indices].to(device), -1e9)
        loss = nn.functional.cross_entropy(logits, targets[indices].to(device))
        optimizer.zero_grad(); loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1)
        optimizer.step()
        with torch.no_grad():
            model.gain.clamp_(-1, 1)
        history.append(float(loss.detach()))
        print(json.dumps({'step': step + 1, 'loss': history[-1], 'elapsed_s': round(time.time() - started, 1)}), flush=True)
    with torch.no_grad():
        correct = 0
        for start in range(0, len(validation), args.batch):
            logits = model(validation[start:start + args.batch].to(device))
            logits = logits.masked_fill(~validation_masks[start:start + args.batch].to(device), -1e9)
            correct += int((logits.argmax(1).cpu() == validation_targets[start:start + args.batch]).sum())
    after, replay = evaluate(model, [2000], device)
    changed = int((model.gain.detach() != before_gain).sum())
    assert changed > 0, '연결 gain이 학습되지 않았습니다.'
    report = {'manifest': manifest, 'training_seeds': list(range(20)), 'validation_seeds': [1000, 1001],
              'evaluation_seeds': [2000], 'device': str(device), 'steps': args.steps,
              'loss_history': history, 'changed_neuron_gains': changed,
              'validation_teacher_agreement': correct / len(validation),
              'before': before, 'after': after, 'elapsed_seconds': time.time() - started,
              'note': '소규모 행동 모방학습 실험. 생물학적 재현 및 일반화 성능 검증이 아님.'}
    (args.output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    (args.output / 'replay.json').write_text(json.dumps({'report': report, 'frames': replay}, ensure_ascii=False), encoding='utf-8')
    torch.save({'state_dict': model.state_dict(), 'manifest': manifest}, args.output / 'checkpoint.pt')
    print(json.dumps({k: v for k, v in report.items() if k not in ['manifest', 'loss_history']}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
