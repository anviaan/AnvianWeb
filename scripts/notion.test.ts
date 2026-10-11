import { test, afterEach } from 'bun:test';
import type { Project } from '../src/data/types.ts';
import type { NotionRow, NotionProperty } from './notion.ts';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { applyNotionCounts, projectFromNotion, syncNotion } from './notion.ts';
const rich = (value: string) => ({ rich_text: [{ plain_text: value }] });
const project: Project = {
  description: '',
  icon: null,
  image: null,
  github: null,
  featured: false,
  id: 'one',
  name: 'Old',
  type: 'mod',
  sources: {
    modrinth: {
      url: 'https://modrinth.com/mod/one',
      downloads: 10,
      updatedAt: '2026-10-01T00:00:00Z',
      stale: false,
    },
  },
  expectedSources: ['modrinth', 'curseforge'],
  platformLinks: {
    curseforge: 'https://www.curseforge.com/minecraft/mc-mods/one',
  },
};
const row: NotionRow = {
  id: 'page',
  properties: {
    Game: { select: { name: 'Minecraft-Java' } },
    Name: { title: [{ plain_text: 'One' }] },
    WebId: rich('one'),
    WebType: { select: { name: 'mod' } },
    WebDescription: rich('Public description'),
    WebModrinth: { url: 'https://modrinth.com/mod/one' },
    WebCurseForge: { url: project.platformLinks!.curseforge },
    WebFeatured: { checkbox: true },
    PublishOnWeb: { checkbox: true },
    Downloads: { number: 100 },
    DownloadsStatus: { select: { name: 'current' } },
    ModrinthDownloads: { number: 20 },
    ModrinthUpdatedAt: { date: { start: '2026-10-09T00:00:00Z' } },
    CurseForgeDownloads: { number: 80 },
    CurseForgeUpdatedAt: { date: { start: '2026-10-09T00:00:00Z' } },
  },
};
const env = { NOTION_TOKEN: 'test', NOTION_DATA_SOURCE_ID: 'test' };
const response = (rows: NotionRow[]) =>
  Response.json({ results: rows, has_more: false });
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture(previous: Project[] = [project]) {
  const path = await mkdtemp(tmpdir() + '/notion-test-');
  directories.push(path);
  const dir = pathToFileURL(path + '/');
  await mkdir(new URL('src/data/', dir), { recursive: true });
  const file = new URL('src/data/projects.json', dir);
  await writeFile(file, JSON.stringify(previous));
  return { dir, file };
}
test('Notion total is not double counted; invalid, old and future counts remain honest', () => {
  const p = applyNotionCounts(project, row, '2026-10-09T01:00:00Z');
  assert.equal(p.reportedDownloads!.value, 100);
  assert.equal(p.reportedDownloads!.stale, false);
  assert.equal(p.sources.curseforge.downloads, 80);
  const broken = structuredClone(row);
  broken.properties.CurseForgeDownloads.number = null;
  broken.properties.Downloads.number = null;
  const stale = applyNotionCounts(p, broken, '2026-10-09T01:00:00Z');
  assert.equal(stale.sources.curseforge.downloads, 80);
  assert.equal(stale.reportedDownloads!.value, 100);
  assert.equal(stale.reportedDownloads!.stale, true);
  broken.properties.Downloads.number = 100;
  assert.equal(
    applyNotionCounts(p, broken, '2026-10-09T01:00:00Z').reportedDownloads!
      .partial,
    true,
  );
  assert.equal(
    applyNotionCounts(project, row, '2026-10-12T00:00:00Z').reportedDownloads!
      .stale,
    true,
  );
  assert.equal(
    applyNotionCounts(project, row, '2026-10-08T00:00:00Z').sources.modrinth
      .downloads,
    10,
  );
});
test('metadata comes from Notion; optional fields clear and private content is excluded', () => {
  const p = projectFromNotion(
    row,
    [
      {
        ...project,
        icon: 'https://example.com/old.png',
        github: 'https://github.com/old/repo',
      },
    ],
    '2026-10-09T01:00:00Z',
  );
  assert.equal(p.name, 'One');
  assert.equal(p.description, 'Public description');
  assert.equal(p.featured, true);
  assert.equal(p.icon, null);
  assert.equal(p.github, null);
  assert.equal(p.reportedDownloads!.value, 100);
  assert.equal(JSON.stringify(p).includes('page'), false);
});
test('invalid public metadata and private/signed URLs are rejected', () => {
  for (const [key, value] of [
    ['WebId', rich('../bad')],
    ['Name', { title: [] }],
    ['WebType', { select: { name: 'other' } }],
    ['WebModrinth', { url: 'https://evil.example/mod/one' }],
    ['WebGitHub', { url: 'javascript:alert(1)' }],
    ['WebImage', { url: 'https://example.com/a?X-Amz-Signature=secret' }],
    ['WebIcon', { url: 'https://www.notion.so/private' }],
  ] as [string, NotionProperty][]) {
    const broken = structuredClone(row);
    broken.properties[key] = value;
    assert.throws(() => projectFromNotion(broken, []));
  }
});
test('missing initial counts do not invent a zero; changed links discard old baselines', () => {
  const broken = structuredClone(row);
  for (const key of ['Downloads', 'ModrinthDownloads', 'CurseForgeDownloads'])
    broken.properties[key].number = null;
  const p = projectFromNotion(broken, []);
  assert.deepEqual(p.sources, {});
  assert.equal(p.reportedDownloads, undefined);
  broken.properties.WebModrinth.url = 'https://modrinth.com/mod/new';
  const changed = projectFromNotion(broken, [
    {
      ...project,
      reportedDownloads: { value: 123, stale: false, partial: false },
    },
  ]);
  assert.equal(changed.sources.modrinth, undefined);
  assert.equal(changed.reportedDownloads, undefined);
  const zero = structuredClone(row);
  zero.properties.Downloads.number = 0;
  assert.equal(projectFromNotion(zero, []).reportedDownloads!.value, 0);
});
test('pagination and Notion failures preserve snapshot without a registry', async () => {
  const { dir, file } = await fixture();
  const original = await readFile(file, 'utf8');
  await assert.rejects(
    syncNotion(async () => new Response(null, { status: 403 }), dir, env),
  );
  assert.equal(await readFile(file, 'utf8'), original);
  await assert.rejects(
    syncNotion(async () => response([]), dir, {}),
    /Configure/,
  );
  let calls = 0;
  await syncNotion(
    async () =>
      Response.json(
        ++calls === 1
          ? { results: [], has_more: true, next_cursor: 'next' }
          : { results: [row], has_more: false },
      ),
    dir,
    env,
  );
  assert.equal(calls, 2);
  assert.equal(JSON.parse(await readFile(file, 'utf8'))[0].name, 'One');
});
test('new Notion projects are added and unpublished/deleted projects disappear', async () => {
  const { dir, file } = await fixture();
  const added = structuredClone(row);
  added.properties.WebId = rich('two');
  added.properties.WebModrinth.url = 'https://modrinth.com/mod/two';
  added.properties.WebCurseForge.url = null;
  const unpublished = structuredClone(row);
  unpublished.properties.PublishOnWeb.checkbox = false;
  const other = structuredClone(row);
  other.properties.Game.select!.name = 'Terraria';
  const trashed = structuredClone(row);
  trashed.in_trash = true;
  await syncNotion(
    async () => response([added, unpublished, other, trashed]),
    dir,
    env,
  );
  const result: Project[] = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(
    result.map((p) => p.id),
    ['two'],
  );
  assert.equal(result[0].sources.modrinth.downloads, 20);
});
test('duplicates, invalid rows, empty selection and broken pagination never overwrite snapshot', async () => {
  const { dir, file } = await fixture();
  const original = await readFile(file, 'utf8');
  const duplicateLink = structuredClone(row);
  duplicateLink.properties.WebId = rich('two');
  for (const rows of [
    [],
    [row, row],
    [row, duplicateLink],
    [
      {
        properties: {
          Game: { select: { name: 'Minecraft-Java' } },
          PublishOnWeb: { checkbox: true },
        },
      },
    ],
  ]) {
    await assert.rejects(syncNotion(async () => response(rows), dir, env));
    assert.equal(await readFile(file, 'utf8'), original);
  }
  await assert.rejects(
    syncNotion(
      async () =>
        Response.json({ results: [], has_more: true, next_cursor: 'repeat' }),
      dir,
      env,
    ),
    /pagination/,
  );
  assert.equal(await readFile(file, 'utf8'), original);
});
test('Notion Archived status is imported and can be cleared', () => {
  const archived = structuredClone(row);
  archived.properties.Status = { select: { name: 'Archived' } };
  const result = projectFromNotion(archived, []);
  assert.equal(result.archived, true);
  archived.properties.Status.select!.name = 'Done';
  assert.equal(projectFromNotion(archived, [result]).archived, false);
});
