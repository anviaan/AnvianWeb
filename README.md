# AnvianWeb

Anvian’s Minecraft projects and original blog, in English. Static Astro + TypeScript, native search/filter controls, Markdown articles, RSS and sitemap. No individual mod pages, accounts, database, or runtime platform API calls.

## Local development

Node **22.12+** (even-numbered supported release) and npm:

```sh
npm ci
npm run dev
npm test
npm run check
npm run build
npm run preview
```

## Catalog

- `data/registry.json`: explicit editorial IDs and platform mappings; optional `name`, `description`, `type`, `image`, `github`, `featured` overrides and a verified `curseforgeUrl` independent of whether its count is available. CurseForge-only entries require verified `curseforgeId` and a `type`; no name-based merging.
- `src/data/projects.json`: public snapshot, no credentials. `sources` contains each platform’s URL, count, update timestamp and stale flag; `expectedSources` identifies partial totals.
- `npm run sync`: discover public Modrinth projects, refresh mapped CurseForge projects and preserve last known counts on errors. A missing initial count is unavailable, not zero. Nonzero exit signals partial or failed synchronization, even when the usable snapshot is updated.
- IDs for 16 CurseForge mappings were read from the author’s publication workflows; two more (Survive To Zombies 2 and SculkHorn3D) were verified on official project pages. Canonical platform links were followed from the author’s public CurseForge profile. This is **not yet a complete audit of CurseForge-only projects**. Add verified entries explicitly; the profile spans other games and pagination; only verified Minecraft entries are included.
- WorldRemover is editorially classified as a datapack from its description and source repository; its Modrinth route remains the API-provided `/mod/` URL.
- Images and icons come from the author’s Modrinth project galleries; blog images were copied from BlogAnvian. Fonts are bundled through Fontsource.
- Downloads are platform-reported download events, not unique users. Totals include only available source counts. Stale values retain their original timestamp.

Do not put API keys in JSON, `PUBLIC_*`, Docker build arguments, or client code. For local synchronization set `CURSEFORGE_API_KEY` in your shell without committing it.

## GitHub Actions

Validation runs on pushes to `main` and pull requests. Daily sync runs at **11:00 UTC / 06:00 America/Lima** (GitHub scheduling is best-effort), or manually through **Actions → Refresh project catalog → Run workflow**.

Configure repository **Actions secrets**:

| Secret | Purpose |
| --- | --- |
| `CURSEFORGE_API_KEY` | Official API read access (`x-api-key`), not the publishing token |
| `DOKPLOY_URL` | HTTPS base URL of your Dokploy instance |
| `DOKPLOY_API_KEY` | Access to trigger deployment of this application |
| `DOKPLOY_APPLICATION_ID` | Target application ID |

Allow Actions to write repository contents. If branch rules forbid direct bot commits, permit this workflow’s bot before enabling scheduled sync. Runs serialize to avoid overlapping catalog updates.

After validating the snapshot, the bot commits it and explicitly calls `/api/application.deploy`. This avoids relying on workflows/webhooks from `GITHUB_TOKEN` commits. A deployment request does **not** prove Dokploy completed the build: inspect Dokploy logs and verify the live catalog date. Partial platform failures still publish usable data and then mark the workflow failed. No secrets are printed.

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

Local build and container checks are separate from production readiness. CurseForge live counts require your API key. Daily end-to-end automation requires GitHub secrets and a real Dokploy application. Do not claim production deployment or change the old blog/DNS until those checks pass.
