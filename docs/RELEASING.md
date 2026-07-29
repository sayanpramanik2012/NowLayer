# Releasing NowLayer

NowLayer uses semantic versions in the form `MAJOR.MINOR.PATCH`. Every push to `main` is validated, packaged on a clean Windows runner, and published as a GitHub Release.

## Choose the release type

- Patch: fixes and small improvements that preserve existing behavior.
- Minor: backward-compatible features.
- Major: breaking behavior or compatibility changes.

`package.json` defines the minimum next version. For an ordinary fix, leave it unchanged: the workflow increments the patch number from the newest existing release. To start a new minor or major line, update the package version without creating a local tag:

```powershell
npm.cmd version minor --no-git-tag-version
# or
npm.cmd version major --no-git-tag-version
```

Commit the resulting `package.json` and `package-lock.json` changes with the feature work, then push `main`:

```powershell
git push origin main
```

The release workflow then:

1. chooses `package.json`'s version for the first release, or increments the newest release's patch number;
2. reuses the same version when the same workflow run is retried;
3. installs locked dependencies on a clean Windows runner;
4. runs all syntax checks and tests;
5. builds the NSIS installer;
6. creates the GitHub Release with the downloadable EXE and generated release notes; and
7. deletes older releases and their tags so only the newest three public versions remain.

Pull requests run the lighter **Verify** workflow. The installer/release build runs only after a commit reaches `main`.

## Optional Windows code signing

Unsigned builds work, but Windows SmartScreen can warn users. To sign releases, add these GitHub repository secrets:

- `WINDOWS_CSC_LINK`: a base64-encoded PFX certificate or supported certificate URL.
- `WINDOWS_CSC_KEY_PASSWORD`: the certificate password.

The workflow maps them to electron-builder's `CSC_LINK` and `CSC_KEY_PASSWORD` variables. Never place a certificate or password in the repository.

## First release

The first public standalone release is `v1.0.0`. Push to `main`, monitor the **Build and Release** workflow, and download its EXE once the GitHub Release is published.
