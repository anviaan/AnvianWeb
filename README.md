# AnvianWeb

Anvian’s Minecraft projects and original blog, in English. Static Astro + TypeScript, native search/filter controls, Markdown articles, RSS and sitemap. No individual mod pages, accounts, database, or runtime platform API calls.

## Local development

Node **22.18+** (even-numbered supported release) and npm:

```sh
npm ci
npm run dev
npm test
npm run check
npm run build
npm run preview
```

Scripts and tests use TypeScript executed directly by Node (native type stripping).
`npm run check` checks the Astro site and strictly type-checks the scripts with
`tsc --noEmit`; no runtime transpiler or emitted JavaScript is needed.

## Catalog — Notion is the source of truth

`npm run sync` reads Game Projects through Notion and generates
`src/data/projects.json`. This public snapshot is the only catalog input to the
static build and the last-known download baseline; do not edit it manually.
There is no local editorial registry or direct Modrinth/CurseForge importer.

Only `Minecraft-Java` rows with `PublishOnWeb` checked are published. Unchecking
it (or deleting/trashing a row) removes the project on the next successful sync.
`Status = Archived` keeps it visible with an Archived badge.

| Notion property | Public data |
| --- | --- |
| `Name` (title) | Project name |
| `WebId` (text) | Unique stable ID: lowercase letters, digits, underscores, hyphens |
| `WebDescription` (text) | Public description, never the private page body |
| `WebType` (select) | `mod`, `modpack`, `resourcepack`, `datapack` |
| `WebIcon`, `WebImage` (URL) | Optional permanent public HTTPS images |
| `WebGitHub` (URL) | Optional GitHub repository |
| `WebModrinth`, `WebCurseForge` (URL) | At least one official project link; defines expected count sources |
| `WebFeatured` (checkbox) | Include among up to four active homepage highlights |
| `PublishOnWeb` (checkbox) | Explicit publication consent; unchecked by default |

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

Use permanent public image URLs, not Notion uploads or signed attachment URLs.
Private page bodies, credentials and attachment URLs are never imported.
Do not put secrets in JSON, `PUBLIC_*`, Docker build arguments or client code.

## GitHub Actions

Validation runs on pushes to `main` and pull requests. Daily sync runs at **11:00 UTC / 06:00 America/Lima** (GitHub scheduling is best-effort), or manually through **Actions → Refresh project catalog → Run workflow**.

Configure repository **Actions secrets**:

| Secret | Purpose |
| --- | --- |
| `NOTION_TOKEN` | Read-only Notion integration shared with Game Projects |
| `NOTION_DATA_SOURCE_ID` | Game Projects data source ID |
| `DOKPLOY_URL` | HTTPS base URL of your Dokploy instance |
| `DOKPLOY_API_KEY` | Access to trigger deployment of this application |
| `DOKPLOY_APPLICATION_ID` | Target application ID |

Allow Actions to write repository contents. If branch rules forbid direct bot commits, permit this workflow’s bot before enabling scheduled sync. Runs serialize to avoid overlapping catalog updates.

After validating the snapshot, the bot commits it and explicitly calls `/api/application.deploy`. This avoids relying on workflows/webhooks from `GITHUB_TOKEN` commits. A deployment request does **not** prove Dokploy completed the build: inspect Dokploy logs and verify the live catalog date. Partial count failures still publish usable data and then mark the workflow failed. No secrets are printed.

## Dokploy

1. Create an Application linked to `anviaan/AnvianWeb`, branch `main`, root build context `/`, build type **Dockerfile**, path `Dockerfile`.
2. Enable auto-deploy for human pushes to `main`; configure the Actions secrets above for bot-generated catalog updates.
3. Container port **80**. No database, persistent volume, runtime secrets, or application environment variables are required.
4. First deploy to a temporary Dokploy hostname and check `/`, `/projects/`, `/blog/`, both articles, `/rss.xml`, `/sitemap-index.xml` and `/robots.txt`.
5. Connect `anvian.net` and enable HTTPS only once the temporary site passes validation. Set DNS deliberately, not as part of local setup.

Local container check:

```sh
docker build -t anvian-web .
docker run --rm -p 8080:80 anvian-web
```

## Blog migration and redirects

BlogAnvian is untouched. Original article bodies, dates, slugs, links and local images are preserved. The Hugo resources shortcode became a Markdown link list. Mermaid diagrams load only on articles containing diagram blocks; source remains readable if rendering fails.

New article URLs: `/blog/hello_world/` and `/blog/mcmodtest/`.

Nginx redirects legacy `/posts/:slug/` to `/blog/:slug/`. After the new website is verified, connect `blog.anvian.net` to this application and retire the old service only after testing:

```sh
curl -I https://blog.anvian.net/
curl -I https://blog.anvian.net/posts/hello_world/
curl -I https://blog.anvian.net/posts/mcmodtest/
curl -I https://blog.anvian.net/index.xml
```

Expect permanent redirects to the corresponding canonical `anvian.net` URLs and RSS. Former `/tags/` and `/categories/` archive URLs redirect to the blog index; those taxonomy pages are not rebuilt in v1. Image URLs remain available at the same `/images/` paths. Unknown paths return a real 404, not the homepage.

## Activation status

Mermaid is used only for the migrated article’s flowcharts. KaTeX is overridden to its patched 0.19 release to avoid an advisory in Mermaid’s older transitive version.

Local build and container checks are separate from production readiness. Counts come from the existing n8n flow through Notion. Daily end-to-end automation requires GitHub secrets and a real Dokploy application. Do not claim production deployment or change the old blog/DNS until those checks pass.

## Notion / n8n download synchronization

`npm run sync` now reads Game Projects through the official Notion API. It does
not call CurseForge or require `CURSEFORGE_API_KEY`. Keep that credential in n8n.
Configure GitHub secret `NOTION_TOKEN` with a read-only integration shared only
with Game Projects, and GitHub secret `NOTION_DATA_SOURCE_ID`:
`b9afc51f-cce1-4059-a95d-db22c635081b`.
The chat Notion connection is not a credential for unattended Actions.

The n8n flow writes `Downloads` (already combined), `ModrinthDownloads`,
`CurseForgeDownloads`, `ModrinthUpdatedAt`, `CurseForgeUpdatedAt`,
and `DownloadsStatus` (`current`, `stale`, `partial`). The combined total is never
added to platform counts. Missing source baselines and counts older than 48 hours
are labeled conservatively. A Notion request/schema/mapping failure retains the
snapshot; unmatched projects retain previous counts marked stale. No private page
body or Notion attachment URL is published.

The 20 existing public projects were migrated into the `Web*` properties and
explicitly opted in. Other projects and ideas remain unpublished by default.
The old platform importer and `registry.json` have been removed. Keep n8n's
CurseForge credential; the website does not need it.

Validate the imported n8n workflow first, then run `npm run sync` using the dedicated
Notion token. Verify a real GitHub run and Dokploy deploy before considering daily
updates operational. This change does not configure remote secrets or deploy.
