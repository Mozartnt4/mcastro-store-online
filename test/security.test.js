import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { __test } = await import("../src/index.js");

test("senha administrativa usa PBKDF2 com salt e valida corretamente", async () => {
  const first = await __test.passwordHash("uma-senha-segura");
  const second = await __test.passwordHash("uma-senha-segura");

  assert.match(first, /^pbkdf2_sha256\$210000\$/);
  assert.notEqual(first, second);
  assert.equal(await __test.passwordMatches("uma-senha-segura", first), true);
  assert.equal(await __test.passwordMatches("senha-incorreta", first), false);
});

test("URLs inseguras não entram no catálogo", () => {
  assert.equal(__test.safeHttpsUrl("javascript:alert(1)"), "");
  assert.equal(__test.safeHttpsUrl("http://example.com/foto.jpg"), "");
  assert.equal(__test.safeHttpsUrl("https://example.com/foto.jpg"), "https://example.com/foto.jpg");
});
