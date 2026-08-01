# #160 V2 release-validation handoff

Use this index to execute the settled #91, #159 and #161 workflow during release validation.

## Inputs

- Author path: [V2 onboarding guide](v2-onboarding-guide.md)
- Prepared fixture: `examples/v2-onboarding/prepared-vault/`
- Migration fixture: `examples/v2-onboarding/migration-vault/`
- Manual sequence: [Onboarding and example-vault validation](v2-onboarding-manual-validation.md)
- Screenshot production: [Screenshot checklist](v2-onboarding-screenshot-checklist.md)
- Recovery path: [Onboarding guide — Recovery and troubleshooting](v2-onboarding-guide.md#recovery-and-troubleshooting)
- Exact labels: [Command and UI reference](v2-command-reference.md)

## Expected states

- A clean empty vault: **Ready to begin**.
- Unrelated Markdown without a Book: **Existing notes found, but no manuscript is recognised**.
- Prepared example: **Project already prepared**; one Book, two Parts, five Scenes; no preparation action.
- Migration example: **Preparation available** for The Low Water Ledger; exact #91 preview opens from the Book-specific action.
- A disposable duplicate-prefix or unresolved-parent variant: preparation blocked with named diagnostics and no approval action.

## Archive procedure

Run `npm run example:archive`. The expected output is `dist/mwc-v2-example-vaults.zip`. Run the command twice from unchanged source and compare SHA-256 hashes; they must match. Test the ZIP with the platform's archive verifier and confirm it contains only the two vaults and their README files—no `.git`, `.obsidian`, workspace state, plugin binary, editorial data or generated report.

Automated `V2ExampleVault.test.ts` checks metadata, hierarchy, keys, entity identity, chronology, relationships, World Context, Reference provenance, safety rules, links, labels and archive reproducibility.

## Release matrix boundaries

Validate clean install, V1 upgrade, plugin reload, uninstall/reinstall and the full sequence on supported Windows and Linux versions. The current unreadable-editorial-storage limitation remains a storage/startup case: startup can stop before onboarding renders, and validation must not weaken that error handling. A standalone **Generate references report** command is not implemented; test Reference entities and `world_sources`, and do not record a missing command as an example-vault defect.
