# AnvianWeb

Anvian’s Minecraft projects and original blog, in English. Static Astro + TypeScript, native search/filter controls, Markdown articles, RSS and sitemap. No individual mod pages, accounts, database, or runtime platform API calls.

## Local development

Bun **1.3.14** (pinned in CI and Docker):

```sh
bun install --frozen-lockfile
bun run dev
bun test
bun run check
bun run build
bun run preview
```

Bun executes the TypeScript scripts and loads local `.env` files. Never commit
credentials. `bun run check` checks Astro and strictly type-checks the scripts.
`bun.lock` is the only dependency lockfile; Node.js and npm are not required.

Styling uses Tailwind CSS v4, with theme and Markdown styles in
`src/styles/global.css`. Platform icons are static SVGs from `simple-icons`.

```sh
bun run format        # Format source, config and docs; sort Tailwind classes
bun run format:check  # Check formatting without writing files (also runs in CI)
```

Generated catalog JSON, lockfile, build output, assets and original blog articles
are excluded from formatting.

## Catalog — Notion and n8n

`bun run sync` reads Game Projects through Notion and generates
`src/data/projects.json`. This public snapshot is the only catalog input to the
static build and the last-known download baseline; do not edit it manually.
There is no local editorial registry or direct Modrinth/CurseForge importer.

Only `Minecraft-Java` rows with `PublishOnWeb` checked are published. Unchecking
it (or deleting/trashing a row) removes the project on the next successful sync.
`Status = Archived` keeps it visible with an Archived badge.

| Notion property                      | Public data                                                        |
| ------------------------------------ | ------------------------------------------------------------------ |
| `Name` (title)                       | Project name                                                       |
| `WebId` (text)                       | Unique stable ID: lowercase letters, digits, underscores, hyphens  |
| `WebDescription` (text)              | Public description, never the private page body                    |
| `WebType` (select)                   | `mod`, `modpack`, `resourcepack`, `datapack`                       |
| `WebIcon`, `WebImage` (URL)          | Optional permanent public HTTPS images                             |
| `WebGitHub` (URL)                    | Optional GitHub repository                                         |
| `WebModrinth`, `WebCurseForge` (URL) | At least one official project link; defines expected count sources |
| `WebFeatured` (checkbox)             | Include among up to four active homepage highlights                |
| `PublishOnWeb` (checkbox)            | Explicit publication consent; unchecked by default                 |

To add a project, complete its public fields and check `PublishOnWeb`. Edits are
applied by the next sync, including empty optional fields. Platform IDs and n8n
count fields remain in Notion; no matching by project name is performed.

Downloads are platform-reported events, not unique users. Invalid/missing counts
retain the previous valid value and timestamp, marked stale/partial. Baselines
are reused only for unchanged project IDs and platform links. The n8n combined
`Downloads` total is never added to individual platform counts. No initial valid
count is shown as unavailable, not zero. Incomplete counts produce a nonzero exit
but still save usable catalog data. Invalid metadata, duplicate IDs/links,
request/pagination failures or an empty published catalog leave the snapshot
unchanged. An API failure therefore does not update the deployed freshness flags.

### Download counts from n8n

n8n updates `Downloads` (combined total), `ModrinthDownloads`,
`CurseForgeDownloads`, `ModrinthUpdatedAt`, `CurseForgeUpdatedAt`, and
`DownloadsStatus` (`current`, `stale`, `partial`) in Notion. Counts older than
48 hours are treated as stale.

The website reads Notion, not the platform APIs. Keep `CURSEFORGE_API_KEY` in
n8n; it is not needed by the website or GitHub Actions.

Use permanent public image URLs, not Notion uploads or signed attachment URLs.
Private page bodies, credentials and attachment URLs are never imported.
Do not put secrets in JSON, `PUBLIC_*`, Docker build arguments or client code.

## GitHub Actions

Validation runs on pushes to `main` and pull requests. Daily sync runs at **11:00 UTC / 06:00 America/Lima** (GitHub scheduling is best-effort), or manually through **Actions → Refresh project catalog → Run workflow**.

Configure repository **Actions secrets**:

| Secret                  | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `NOTION_TOKEN`          | Read-only Notion integration shared with Game Projects |
| `NOTION_DATA_SOURCE_ID` | Game Projects data source ID                           |

Use a read-only Notion integration shared with **Game Projects**. Its data source
ID is `b9afc51f-cce1-4059-a95d-db22c635081b`. For local synchronization, set the
same variables in a local `.env` file and run `bun run sync`.

Allow Actions to write repository contents. If branch rules forbid direct bot commits, permit this workflow’s bot before enabling scheduled sync. Runs serialize to avoid overlapping catalog updates.

After validating the snapshot, the bot commits and pushes it only when the catalog changes. Dokploy’s GitHub integration handles deployment on pushes to `main`; Actions does not call the Dokploy API or need Dokploy credentials. Pushes made with `GITHUB_TOKEN` do not start another push-triggered Actions run, so validation runs in this sync workflow before the commit. Verify that a bot-generated catalog push triggers Dokploy, inspect the build logs, and confirm the live catalog date. Partial count failures still publish usable data and then mark the workflow failed. No secrets are printed.

## Blog and redirects

Articles live in `src/data/blog/`. The imported articles retain their original
bodies, dates, slugs, links and local images. Their URLs are
`/blog/hello_world/` and `/blog/mcmodtest/`.

Mermaid loads only on articles containing diagrams; diagram source remains
readable if rendering fails. The KaTeX override in `package.json` avoids the
advisory affecting Mermaid’s older transitive dependency.

`nginx.conf` defines these permanent redirects:

- `/posts/:slug/` → `https://anvian.net/blog/:slug/`.
- On `blog.anvian.net`, the root and former tag/category archives → the blog index.
- On `blog.anvian.net`, `/index.xml` and `/posts/index.xml` → `https://anvian.net/rss.xml`.

Local images remain under `/images/`. Unknown paths on the main site return a real 404. These rules describe the container configuration, not verified live routing.

When connecting the legacy blog hostname, verify redirects before retiring any
old service:

```sh
curl -I https://blog.anvian.net/
curl -I https://blog.anvian.net/posts/hello_world/
curl -I https://blog.anvian.net/posts/mcmodtest/
curl -I https://blog.anvian.net/index.xml
```
