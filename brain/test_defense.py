import unittest
import numpy as np
from defense import Defense, OBSERVATIONS, difficulty, ROUND_TICKS, MAX_ROUNDS
import torch
from train import BrainPolicy


class DefenseTests(unittest.TestCase):
    def test_round_boundary_and_scaling(self):
        self.assertEqual(difficulty(ROUND_TICKS - 1)['round'], 1)
        self.assertEqual(difficulty(ROUND_TICKS)['round'], 2)
        previous = difficulty(0)
        for number in range(1, MAX_ROUNDS):
            current = difficulty(number * ROUND_TICKS)
            self.assertGreater(current['hp'], previous['hp'])
            self.assertGreater(current['speed_multiplier'], previous['speed_multiplier'])
            self.assertLessEqual(current['spawn_interval'], previous['spawn_interval'])
            previous = current

    def test_round_spawn_and_end(self):
        env = Defense(2)
        env.tick = ROUND_TICKS
        env.step(0)
        self.assertEqual(env.snapshot()['wave'], 2)
        self.assertEqual(env.enemies[0]['max_hp'], difficulty(ROUND_TICKS)['hp'])
        env.tick = ROUND_TICKS * MAX_ROUNDS - 1
        env.step(0)
        self.assertTrue(env.done)
        self.assertEqual(env.snapshot()['wave'], MAX_ROUNDS)

    def test_graph_gain_receives_gradient(self):
        graph = torch.tensor([[0., 1., 0.], [-1., 0., 1.], [0., 1., 0.]]).to_sparse_csr()
        model = BrainPolicy(graph)
        old = model.gain.detach().clone()
        optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
        loss = model(torch.ones(2, OBSERVATIONS)).square().mean()
        loss.backward()
        self.assertTrue(torch.isfinite(model.gain.grad).all())
        optimizer.step()
        self.assertFalse(torch.equal(old, model.gain.detach()))
        self.assertTrue(torch.equal(graph.to_dense(), model.graph.to_dense()))

    def test_reproducible_and_legal(self):
        a, b = Defense(51), Defense(51)
        while not a.done:
            self.assertEqual(len(a.observe()), OBSERVATIONS)
            self.assertTrue(np.isfinite(a.observe()).all())
            action = a.teacher()
            self.assertTrue(a.mask()[action])
            a.step(action); b.step(action)
            self.assertEqual(a.snapshot(), b.snapshot())
            self.assertGreaterEqual(a.gold, 0)

    def test_invalid_action_and_terminal(self):
        env = Defense(1)
        with self.assertRaises(ValueError):
            env.step(9)
        while not env.done:
            env.step(0)
        old = env.snapshot()
        env.step(0)
        self.assertEqual(old, env.snapshot())


if __name__ == '__main__':
    unittest.main()
