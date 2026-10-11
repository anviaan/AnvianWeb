import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('diagrams retain intrinsic width', async () => {
  const css = await readFile('src/styles/global.css', 'utf8');
  assert.match(css, /\.diagram svg\s*\{\s*@apply mx-auto block h-auto;/);
});
