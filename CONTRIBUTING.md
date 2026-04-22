# Contributing to GeckoTask

## Development

- Clone the repo, run `npm ci`, then `npm run dev` or `npm run build` as in [`README.md`](README.md).
- Before opening a PR, run `npm run lint`, `npm run typecheck`, and `npm run build` (same checks as [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Cutting a release (maintainers)

Releases are **tag-driven**. [`.github/workflows/release.yml`](.github/workflows/release.yml) builds artifacts and creates the GitHub Release. The workflow **fails** unless the pushed tag exactly matches both `manifest.json` and `package.json` `version`.

1. On `main`, bump **`manifest.json`** and **`package.json`** `version` to the same SemVer string (e.g. `0.2.0`).
2. If **`minAppVersion`** in `manifest.json` changed, add the corresponding entry to [`versions.json`](versions.json).
3. Update a changelog or release notes if you maintain one (optional: use GitHub auto-generated release notes and edit after publish).
4. Commit and push to `main` (for example `chore: release 0.2.0`).
5. Create an **annotated or lightweight tag** with the same string as `version`, **without** a `v` prefix: `git tag 0.2.0` then `git push origin 0.2.0`.
6. Confirm the **Release** workflow succeeded and the release lists **`main.js`**, **`manifest.json`**, and **`styles.css`** as downloadable assets.

Agents follow [`AGENTS.md`](AGENTS.md) versioning rules; they should not bump versions unless the task includes a release.

### Prerelease tags (optional)

The current release workflow only matches tags of the form `x.y.z` (three numeric segments). Shipping SemVer prereleases such as `1.0.0-beta.1` would require extending the tag filter in `release.yml`. Obsidian’s update behavior for prerelease versions can surprise users; see the [BRAT developer guide](https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md) and [Obsidian plugin docs](https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions) before adopting betas.

### BRAT installs

Beta installs via [BRAT](https://github.com/TfTHacker/obsidian42-brat) use the latest GitHub Release assets. See [`README.md`](README.md) for user-facing install steps.
