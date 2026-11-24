# Private vault repo, public site repo

The vault lives in its own private GitHub repo (`Obsidian_notes`). The site, the `vaultsync` CLI and CI live in this separate **public** repo. CI checks out the vault with a read-only deploy key at build time. This repo is public because GitHub Actions minutes are free for public repos and capped at 2,000/month for private ones, and the project must cost $0. The cost of that choice: nothing from the vault (content, note titles, folder names) may ever be committed here, or written into issues, logs or test fixtures. Test fixtures are made-up vaults, never copies of the real one.

## Considered Options

- **Site code inside the vault repo**: simplest, but builds would spend private-repo minutes and mix site code with notes in Obsidian.
- **Private site repo**: keeps everything hidden, but daily builds with LibreOffice conversion would eat into the 2,000 free minutes.
