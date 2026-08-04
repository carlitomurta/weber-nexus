import test from "node:test";
import assert from "node:assert/strict";
import { calculateRolloutBucket, isRolloutEligible } from "../rollout.js";

test("calculateRolloutBucket is stable for the same installation seed", () => {
  const first = calculateRolloutBucket("installation-a");
  const second = calculateRolloutBucket("installation-a");

  assert.equal(first, second);
  assert.equal(first >= 1 && first <= 100, true);
});

test("isRolloutEligible applies rollout percentages", () => {
  assert.equal(isRolloutEligible(10, 10), true);
  assert.equal(isRolloutEligible(11, 10), false);
  assert.equal(isRolloutEligible(100, 100), true);
  assert.equal(isRolloutEligible(1, 0), false);
});
