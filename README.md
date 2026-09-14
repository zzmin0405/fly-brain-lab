# Fly Brain Lab

## 실제 전체 연결망 학습 실험

타워 디펜스 학습 코드는 [brain/README.md](brain/README.md)에 있습니다. 실제 v783 배포본의 전체 연결망으로 게임용 모델을 학습하며, `/defense.html`에서 학습된 모델의 저장 리플레이를 확인할 수 있습니다. 기존 미로 제어기는 계속 데모 모델을 사용합니다.

가중치를 조절해 가상 초파리의 랜덤 미로 탐험을 관찰하는 웹 게임 프로토타입입니다.

## 실행

Node.js 22.17 이상(22 계열)과 npm을 사용합니다.

```sh
npm ci
npm run dev
```

## 기능

- 시드 기반 랜덤 미로, 크기 선택, 같은 미로 재도전
- 냄새 반응·탐색·방향 유지 가중치 실시간 조정
- 일시 정지와 속도 변경, 이동 궤적과 냄새 표시
- 도착·이동 한도 결과 및 최근 8회 기록, 이전 경로 비교

현재 제어기는 게임용 모델입니다. 실제 초파리 연결망과 뉴런 시뮬레이션은 아직 연동하지 않았습니다. 자세한 비교와 연동 범위는 [조사 문서](docs/references.md)를 참고하세요.

전체 연결망을 붙일 때의 실행 구조와 감각·운동 계약은 [전체 뇌 설계 문서](docs/whole-brain-architecture.md)에 정리했습니다.

## 개발

- `npm run check`: 타입, 린트, 시뮬레이션 테스트, 프로덕션 빌드
- `npm run test`: 미로 연결성·재현성·통로 이동·종료 조건 검증
- `npm run format`: 코드 포맷
- `npm run preview`: 빌드 미리보기
- `npm run brain:live`: 게임 틱별 행동을 반환하는 로컬 추론 API(`127.0.0.1:8787`) 실행

React·TypeScript·Vite·Canvas 2D로 구성합니다. `src/simulation.ts`는 환경과 제어기, `src/drawMaze.ts`는 렌더링, `src/App.tsx`는 실험 UI입니다. 외부 서버나 API 키 없이 실행됩니다.

방어 게임의 실시간 연결은 `brain/live_api.py`가 담당합니다. 시작할 때 공개 연결망 파일과 `brain/artifacts/run-001/checkpoint.pt`를 로드하고, `/reset`으로 시드를 만들고 `/step`을 호출할 때마다 현재 관측을 전체 그래프 모델에 통과시켜 다음 행동과 상태를 반환합니다. 파일을 찾지 못하면 `/health`와 `/step`에 오류를 반환해 교사 정책으로 조용히 대체하지 않습니다.
