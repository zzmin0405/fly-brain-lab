"""기존 체크포인트를 변경된 방어 환경에서 다시 평가해 리플레이를 저장한다."""
import json
from pathlib import Path
import torch
from train import BrainPolicy, load_graph, evaluate

if __name__ == '__main__':
    torch.set_num_threads(8)
    root = Path(__file__).resolve().parents[1]
    checkpoint = torch.load(root / 'brain/artifacts/run-001/checkpoint.pt', map_location='cpu', weights_only=True)
    graph, manifest = load_graph(root.parent / 'drosophila-brain-reference')
    model = BrainPolicy(graph)
    model.load_state_dict(checkpoint['state_dict'])
    model.eval()
    evaluation, frames = evaluate(model, [2000], torch.device('cpu'))
    original = json.loads((root / 'brain/artifacts/run-001/report.json').read_text(encoding='utf-8'))
    report = {'manifest': manifest, 'changed_neuron_gains': original['changed_neuron_gains'],
              'evaluation': evaluation, 'note': '기존 run-001 체크포인트를 점진 난이도 환경에서 재평가. 재학습 결과가 아님.'}
    (root / 'public/trained-defense.json').write_text(json.dumps({'report': report, 'frames': frames}, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'frames': len(frames), 'last_round': frames[-1]['wave'], 'lives': frames[-1]['lives'], **evaluation}))
