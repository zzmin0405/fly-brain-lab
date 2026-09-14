"""공개 초파리 연결망 정책을 게임 보상으로 직접 업데이트하는 REINFORCE 실험."""
import argparse
import json
from pathlib import Path
import numpy as np
import torch
from torch import nn
from defense import Defense
from train import BrainPolicy, load_graph

def episode(model, seed, device):
    env = Defense(seed); log_probs = []; rewards = []; values = []
    while not env.done:
        obs = torch.from_numpy(env.observe()).to(device)[None]
        logits = model(obs)[0].masked_fill(~torch.from_numpy(env.mask()).to(device), -1e9)
        distribution = torch.distributions.Categorical(logits=logits)
        action = distribution.sample()
        before_kills, before_lives, before_gold = env.kills, env.lives, env.gold
        env.step(int(action))
        reward = (env.kills - before_kills) * 10 + (env.lives - before_lives) * 18
        reward += (env.gold - before_gold) * 0.04 - 0.08
        log_probs.append(distribution.log_prob(action)); rewards.append(reward)
    return torch.stack(log_probs), rewards, env.score()

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--source', type=Path, required=True); parser.add_argument('--output', type=Path, default=Path('brain/artifacts/rl-run-001')); parser.add_argument('--episodes', type=int, default=12); parser.add_argument('--lr', type=float, default=0.00005)
    args = parser.parse_args(); args.output.mkdir(parents=True, exist_ok=False)
    graph, manifest = load_graph(args.source); device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = BrainPolicy(graph).to(device); model.train(); optimizer = torch.optim.Adam(model.parameters(), lr=args.lr); history = []
    for episode_index in range(args.episodes):
        optimizer.zero_grad(); log_probs, rewards, score = episode(model, 7000 + episode_index, device)
        returns = []; running = 0.0
        for reward in reversed(rewards): running = reward + 0.98 * running; returns.append(running)
        returns = torch.tensor(list(reversed(returns)), device=device); returns = (returns - returns.mean()) / (returns.std() + 1e-6)
        loss = -(log_probs * returns).sum(); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); optimizer.step(); history.append({'episode': episode_index + 1, 'score': score, 'loss': float(loss.detach())}); print(json.dumps(history[-1]), flush=True)
    torch.save({'state_dict': model.state_dict(), 'manifest': manifest, 'algorithm': 'REINFORCE', 'episodes': args.episodes}, args.output / 'checkpoint.pt')
    (args.output / 'report.json').write_text(json.dumps({'algorithm': 'REINFORCE', 'episodes': args.episodes, 'history': history, 'note': '공개 연결망 topology를 보존한 게임 보상 기반 정책 업데이트. 생물학적 학습 재현이 아님.'}, ensure_ascii=False, indent=2), encoding='utf-8')

if __name__ == '__main__': main()
