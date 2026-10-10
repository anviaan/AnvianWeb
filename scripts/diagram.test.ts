import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('diagrams retain intrinsic width',async()=>{const css=await readFile('src/styles/global.css','utf8');assert.ok(css.includes('.diagram svg{display:block;height:auto;margin-inline:auto}'));});
