# Large files go to R2 by content hash, tracked in a manifest in the vault

Vault files over 20 MB are uploaded by `vaultsync` to a private Cloudflare R2 bucket under `sha256/<hash>`, git-ignored, and recorded in `media-manifest.json` inside the vault. The site serves them through a Pages Function at `/media/*` that streams from the R2 binding (with Range support), on the same Access-protected hostname. 20 MB stays under the Pages 25 MiB per-file limit and keeps git history small. Content-hash keys mean an unchanged file is never re-uploaded and renames cost nothing.

## Consequences

- `vaultsync` never deletes from R2 and refuses uploads past an 8 GB storage cap. R2 bills automatically beyond 10 GB, so these guards are the only protection against cost. Don't remove them.
- The manifest is the only link between a vault path and its bytes. Losing it means re-hashing the local files to rebuild it.

## Considered Options

- **Git LFS**: GitHub's free LFS quota is small and bandwidth is metered, so every view of a video from the site would count against it. The bytes would also have to be fetched into every CI build.
- **A public bucket**: rejected; nothing in the vault may be reachable without Access.
