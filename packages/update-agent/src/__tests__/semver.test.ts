import test from "node:test";
import assert from "node:assert/strict";
import { compareSemVer, isSemVerUpgrade, normalizeSemVer } from "../semver.js";

test("compareSemVer compares major minor and patch", () => {
  assert.equal(compareSemVer("1.2.3", "1.2.2"), 1);
  assert.equal(compareSemVer("1.2.3", "1.3.0"), -1);
  assert.equal(compareSemVer("v1.2.3", "1.2.3"), 0);
});

test("isSemVerUpgrade only accepts newer versions", () => {
  assert.equal(isSemVerUpgrade("1.0.1", "1.0.0"), true);
  assert.equal(isSemVerUpgrade("1.0.0", "1.0.0"), false);
  assert.equal(isSemVerUpgrade("0.9.9", "1.0.0"), false);
});

test("normalizeSemVer rejects prerelease versions for agent releases", () => {
  assert.throws(() => normalizeSemVer("1.0.0-beta.1"), /Versão inválida/);
});
