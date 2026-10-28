import test from 'node:test';
import assert from 'node:assert/strict';
import { moveTargetWithMouse } from '../src/controls.js';
import { DEFAULTS } from '../src/physics.js';

const start = Object.freeze({x:0,z:-3.8});
test('mouse right moves paddle screen right (world -X from the near camera)', () => {
  const next = moveTargetWithMouse(start, 100, 0, 1, DEFAULTS);
  assert.equal(next.x, -.5);
  assert.equal(next.z, start.z);
});
test('mouse left moves paddle screen left (world +X)', () => {
  const next = moveTargetWithMouse(start, -100, 0, 1, DEFAULTS);
  assert.equal(next.x, .5);
  assert.equal(next.z, start.z);
});
test('vertical direction is unchanged: upward means forward (+Z)', () => {
  const next = moveTargetWithMouse(start, 0, -100, 1, DEFAULTS);
  assert.equal(next.x, start.x);
  assert.equal(next.z, -3.3);
});
test('downward means backward (-Z)', () => {
  const next = moveTargetWithMouse(start, 0, 100, 1, DEFAULTS);
  assert.equal(next.z, -4.3);
});
test('input targets remain inside player bounds', () => {
  const next = moveTargetWithMouse(start, -20000, -20000, 2.5, DEFAULTS);
  assert.ok(next.x <= DEFAULTS.width / 2 - .48);
  assert.equal(next.z, -.22);
});
