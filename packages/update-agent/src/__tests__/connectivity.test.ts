import test from "node:test";
import assert from "node:assert/strict";
import { checkUpdateConnectivity } from "../connectivity.js";

test("checkUpdateConnectivity reports online when endpoint responds ok", async () => {
  const result = await checkUpdateConnectivity({
    fetchImpl: async () => new Response(null, { status: 204 }),
  });

  assert.equal(result.online, true);
  assert.equal(result.error_message, null);
});

test("checkUpdateConnectivity reports offline without throwing", async () => {
  const result = await checkUpdateConnectivity({
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
  });

  assert.equal(result.online, false);
  assert.match(result.error_message ?? "", /Sem conectividade/);
});
