# V2 onboarding example vaults

These two fictional, disposable Obsidian vaults demonstrate Murmuration Writing Companion without using production manuscript prose or modifying an author's live vault.

Begin with the [author Help](../../Help/README.md), then use these vaults to practise the documented workflow safely.

- **prepared-vault** is the normal starting example. Its Book, Parts and Scenes already own canonical `type`, `parent` and sibling-local `manuscript_order_key` properties. It includes a small optional Story World.
- **migration-vault** contains a separate, valid legacy `manuscript_order` example. Copy it before testing **Prepare existing manuscript** and immediate Undo.

Open either directory as its own Obsidian vault. Do not merge it into a live project. No plugin binary, workspace state, user setting, editorial store or generated report is included.

Run `npm run example:archive` from the project source to build the deterministic release archive in `dist/mwc-v2-example-vaults.zip`. The archive is generated output and is not authoritative source material.
