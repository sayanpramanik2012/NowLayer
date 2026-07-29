# Releasing NowLayer

NowLayer uses semantic versions in the form `MAJOR.MINOR.PATCH`. The version in `package.json` and the Git tag must always match.

## Choose the release type

- Patch: fixes and small improvements that preserve existing behavior.
- Minor: backward-compatible features.
- Major: breaking behavior or compatibility changes.

From a clean `main` branch, run one of:

```powershell
npm.cmd run release:patch
npm.cmd run release:minor
npm.cmd run release:major
```

`npm version` updates `package.json` and `package-lock.json`, creates a version commit, and creates a matching `vMAJOR.MINOR.PATCH` Git tag. Publish both with:

```powershell
git push origin main --follow-tags
```

The release workflow then:

1. verifies that the tag matches `package.json`;
2. installs locked dependencies on a clean Windows runner;
3. runs all syntax checks and tests;
4. builds the NSIS installer;
5. stores the installer as a workflow artifact; and
6. creates a GitHub Release with the downloadable EXE and generated release notes.

## Optional Windows code signing

Unsigned builds work, but Windows SmartScreen can warn users. To sign releases, add these GitHub repository secrets:

- `WINDOWS_CSC_LINK`: a base64-encoded PFX certificate or supported certificate URL.
- `WINDOWS_CSC_KEY_PASSWORD`: the certificate password.

The workflow maps them to electron-builder's `CSC_LINK` and `CSC_KEY_PASSWORD` variables. Never place a certificate or password in the repository.

## First release

The first public standalone release is `v1.0.0`. Push the repository first, then push the existing tag after the main branch is available remotely. Monitor the **Build and Release** workflow and download its EXE once the GitHub Release is published.
