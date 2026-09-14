# 전체 연결망 기반 타워 디펜스 학습

FlyWire v783의 Shiu 연구진 배포본을 읽어 실제 그래프를 유지한 게임용 모델을 학습합니다. 배포본에는 뉴런 138,639개와 방향성 연결 15,091,983개가 있습니다. 이 숫자는 개별 시냅스 총수가 아닌 배포본의 연결 행 수이며, 최신 FlyWire의 모든 뉴런 수와 같다는 의미는 아닙니다.

## 모델 범위

- 전체 입력 배포본을 사용하며 뉴런·연결을 선택적으로 잘라내지 않습니다.
- signed 연결 강도를 입력 합으로 정규화한 뒤 3회 rate 계산을 수행합니다.
- 뉴런별 전달 gain, bias, 인공 입력 인코더와 출력 디코더를 학습합니다. 모든 개별 시냅스가 독립적인 학습 파라미터인 것은 아닙니다.
- gain은 양수이므로 원본 연결 부호와 그래프 구조는 유지합니다.
- 게임 입력은 골드·생명·타워 종류/레벨·구역별 적 압력입니다. 출력은 대기·8개 슬롯 구매·8개 슬롯 강화입니다.
- 감각과 행동 매핑은 게임을 위한 인공 인터페이스입니다. 실제 초파리의 타워 구매 회로나 원 논문의 LIF 동역학을 재현하지 않습니다.
- 현재 학습은 수작업 교사의 행동 모방입니다. 사전 학습된 게임 뇌의 파인튜닝이나 도파민 강화학습은 아닙니다.

## 설치 및 실행

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r brain/requirements.txt
git clone https://github.com/philshiu/Drosophila_brain_model.git ../drosophila-brain-reference
.\.venv\Scripts\python.exe brain/train.py --source ../drosophila-brain-reference --steps 40 --batch 4
.\.venv\Scripts\python.exe -m unittest discover -s brain -p test_*.py
```

이번 로컬 검증은 시스템의 기존 CPU PyTorch 2.8.0을 재사용하는 가상환경에서 실행했습니다. GPU는 RTX 4070 Ti 12GB이지만 CUDA PyTorch를 설치하지 않았으므로 GPU 학습 속도를 검증하지 않았습니다.

기존 결과는 덮어쓰지 않습니다. 재실행 시 새로운 `--output brain/artifacts/run-002`를 지정하세요. 체크포인트에는 그래프를 중복 저장하지 않으므로 추론 시 같은 원본 파일이 필요합니다.

## 검증과 결과물

학습 시드는 0~~19, 교사 행동 검증 시드는 1000~~1001, 플레이 비교 시드는 2000입니다. 최종 보고서에는 원본 커밋·파일 해시, 학습 손실, 변경된 gain 수, 교사 일치율, 학습 전후 실제 플레이 점수를 저장합니다. 단일 평가 시드만으로 일반화나 학습 성공을 주장할 수 없습니다. 허용 행동이 대기 하나뿐인 상황은 교사 일치율을 높일 수 있습니다.

`brain/artifacts/run-001/checkpoint.pt`, `report.json`, `replay.json`이 생성됩니다. `public/trained-defense.json`은 공개 화면에 표시할 보고서와 플레이 기록이며 모델 가중치나 원본 연결망은 포함하지 않습니다. `/defense.html`은 저장된 실제 모델 플레이의 리플레이로, 실시간 추론 UI는 아닙니다.

## 출처와 조건

- [배포 저장소](https://github.com/philshiu/Drosophila_brain_model): 커밋 `91bdd1e7dcf193f3e7ca5a8933497fcef63b7960`
- [연구 논문](https://pmc.ncbi.nlm.nih.gov/articles/PMC11446845/): Shiu et al., A Drosophila computational brain model reveals sensorimotor processing (2024)
- [FlyWire 데이터](https://edit.flywire.ai/principles.html): CC BY-NC 4.0. 본 실험은 가중치 정규화 및 전달 gain 학습을 적용했습니다.
- 원 저장소 코드는 MIT이며 저작권자는 Philip Shiu와 Nico Spiller입니다. 이번 학습 코드는 별도 작성했으며 원본 `model.py`를 복사하지 않았습니다.

## 점진 난이도 리플레이

라운드는 32틱(기본 재생 약 15.36초)이며 최대 20라운드까지 진행합니다. 적 체력은 라운드마다 1.22배, 이동 속도는 기본값 대비 4.5%씩 증가합니다. 출현 간격은 4틱에서 시작해 3라운드마다 1틱씩 줄고 최소 1틱입니다. 기지 내구도가 0이 되거나 20라운드 시간이 끝나면 종료합니다. 기존 적은 생성 당시 능력치를 유지합니다.

`python brain/replay.py`는 기존 run-001 체크포인트를 새 환경에서 재평가하고 공개 리플레이를 갱신합니다. 체크포인트 및 형제 디렉터리 `drosophila-brain-reference`의 원본 연결망 파일이 필요합니다. 기존 체크포인트 입력 스케일을 유지하며 재학습은 하지 않습니다. 이번 시드 2000 결과는 11라운드, 351틱에 내구도 0으로 종료되었습니다.
