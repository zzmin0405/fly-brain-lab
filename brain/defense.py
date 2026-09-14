"""시드 기반 타워 디펜스 학습 환경. 시간 단위는 초가 아닌 고정 틱이다."""
import random
import numpy as np

SLOTS = 8
ACTIONS = 17  # 대기, 슬롯별 구매 8개, 슬롯별 강화 8개
OBSERVATIONS = 35
ROUND_TICKS = 32
MAX_ROUNDS = 20
TICK_MS = 480


def difficulty(tick):
    round_number = min(MAX_ROUNDS, tick // ROUND_TICKS + 1)
    return {'round': round_number, 'hp': round(12 * 1.22 ** (round_number - 1), 2),
            'speed_multiplier': 1 + (round_number - 1) * 0.045,
            'spawn_interval': max(1, 4 - (round_number - 1) // 3)}


class Defense:
    def __init__(self, seed):
        self.seed = seed
        self.rng = random.Random(seed)
        self.gold = 90
        self.lives = 12
        self.tick = 0
        self.kills = 0
        self.towers = [0] * SLOTS
        self.enemies = []
        self.done = False
        self.events = []
        # 구매할 타워의 종류는 슬롯에 고정한다. 정책 행동에 따라 추첨열이 달라지지 않는다.
        self.types = [self.rng.randrange(3) for _ in range(SLOTS)]

    def mask(self):
        return np.array([True] + [v == 0 and self.gold >= 30 for v in self.towers]
                        + [0 < v < 3 and self.gold >= 25 * v for v in self.towers], dtype=bool)

    def observe(self):
        threats = [0.0] * SLOTS
        for enemy in self.enemies:
            threats[min(7, int(enemy['position'] * 8))] += enemy['hp'] / 20
        return np.array([self.gold / 200, self.lives / 12, self.tick / 160]
                        + [v / 3 for v in self.towers]
                        + [v / 2 for v in self.types]
                        + threats + self.mask()[9:].astype(float).tolist(), dtype=np.float32)

    def teacher(self):
        legal = self.mask()
        if not legal[1:].any():
            return 0
        # 비교용 수작업 정책. 생물학적 모델이 아니다.
        choices = []
        for slot in range(SLOTS):
            pressure = sum(max(0, 0.28 - abs(e['position'] - (slot + 0.5) / 8))
                           * e['hp'] for e in self.enemies)
            coverage = 1.0 - abs(slot - 3.5) / 8
            if legal[slot + 1]:
                choices.append((2 + coverage + pressure, slot + 1))
            if legal[slot + 9]:
                choices.append((coverage + pressure + self.towers[slot] * 0.15, slot + 9))
        return max(choices)[1]

    def step(self, action):
        if self.done:
            return
        if not 0 <= action < ACTIONS or not self.mask()[action]:
            raise ValueError('허용되지 않은 행동입니다.')
        if 1 <= action <= 8:
            self.towers[action - 1] = 1
            self.gold -= 30
        elif action >= 9:
            slot = action - 9
            self.gold -= 25 * self.towers[slot]
            self.towers[slot] += 1
        self.tick += 1
        self.gold += 2
        settings = difficulty(self.tick - 1)
        if (self.tick - 1) % ROUND_TICKS % settings['spawn_interval'] == 0:
            self.enemies.append({'position': 0.0, 'hp': settings['hp'], 'max_hp': settings['hp'],
                                 'speed': self.rng.uniform(0.018, 0.03) * settings['speed_multiplier']})
        for slot, level in enumerate(self.towers):
            if not level:
                continue
            candidates = [e for e in self.enemies if e['hp'] > 0 and
                          abs(e['position'] - (slot + 0.5) / 8) < (0.20 if self.types[slot] == 1 else 0.14)]
            if candidates:
                target = max(candidates, key=lambda e: e['position'])
                target['hp'] -= level * (3.2 if self.types[slot] == 0 else 2.2)
                if self.types[slot] == 2:
                    target['position'] = max(0, target['position'] - 0.012)
        alive = []
        for enemy in self.enemies:
            if enemy['hp'] <= 0:
                self.gold += 9
                self.kills += 1
                continue
            enemy['position'] += enemy['speed']
            if enemy['position'] >= 1:
                self.lives -= 1
            else:
                alive.append(enemy)
        self.enemies = alive
        self.lives = max(0, self.lives)
        self.done = self.lives <= 0 or self.tick >= ROUND_TICKS * MAX_ROUNDS

    def snapshot(self):
        settings = difficulty(max(0, self.tick - 1))
        return {'seed': self.seed, 'tick': self.tick, 'wave': settings['round'],
                'difficulty': settings, 'round_ticks': ROUND_TICKS, 'max_rounds': MAX_ROUNDS, 'tick_ms': TICK_MS,
                'gold': self.gold, 'lives': self.lives, 'kills': self.kills,
                'towers': self.towers.copy(), 'types': self.types,
                'enemies': [dict(e) for e in self.enemies], 'done': self.done}

    def score(self):
        return self.tick + self.kills * 10 + max(0, self.lives) * 20
