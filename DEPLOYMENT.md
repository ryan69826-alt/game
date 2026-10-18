# Browser hosting

GitHub Pages hosts the standalone HTML as an actual web page. Players can click
the deployed site and play without downloading files or installing anything.
The published game and its bundled art are publicly accessible.

## One-time repository setting

In GitHub, open this repository's **Settings → Pages**. Under **Build and
deployment**, set **Source** to **GitHub Actions**. The repository owner needs
permission to enable Pages, and the repository's visibility/plan must support it.

## Publish updates

Pushing to `main` runs **Publish game to GitHub Pages**. It installs the pinned
compiler/story format, runs the browser checks, and uploads only the built
standalone HTML and `.nojekyll`. Deployment runs only after validation succeeds.
No custom secret or external hosting account is needed; GitHub supplies the
workflow token with Pages deployment permissions.

For the initial deployment, or after enabling Pages, open **Actions → Publish
game to GitHub Pages → Run workflow** on `main` if a run is not already pending.
Use the site link reported by the successful deployment. A configured workflow
alone does not establish that the public site is live.

Browser saves are tied to the site's origin. Saves created in an earlier local
preview can be transferred using the game's disk Save/Load controls.

Cloud automation needs network access to `api.github.com` to enable and monitor
Pages, and `ryan69826-alt.github.io` to verify the published site. If those hosts
are blocked, the source and workflow can still be pushed through the Git proxy,
but Pages activation and public-site verification require the network change or
the repository owner's actions in GitHub.
