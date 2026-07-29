# Unmanaged manuscript deletion and restoration

Issue #149 treats disappearance as a transient integrity condition, never as a manuscript editing command. Current Markdown, vault existence and settled metadata-cache state remain authoritative.

## Event pipeline

`ManuscriptIntegrityCoordinator` receives Markdown create, delete, rename and metadata events plus layout-ready startup. It normalises paths, advances path and batch generations, coalesces events for 100 ms, and retries bounded metadata-cache delays. A result is published only while its batch and every captured path generation remain current.

An ordinary vault rename invalidates both paths but is excluded from deletion fallback. Existing editorial, authoring-session and Story World rename migration remains responsible for identity translation. Delete/create pairs are not guessed to be renames.

Obsidian local-trash moves are the deliberate exception. A move from a manuscript path into the vault-root `.trash` folder is classified as unmanaged deletion: the original path disappears, fallback runs, and editorial identity remains marked as retained at the original path. The trash copy is excluded from manuscript and Story World indexing. A move back out of `.trash` is classified as restoration and reconnects current manuscript metadata and retained same-path editorial data without rename migration.

## Runtime snapshot and fallback

The coordinator retains one in-memory snapshot of the last settled projection. It contains Book order, entry ownership, direct-parent siblings, sparse order keys, selection/context and active-path evidence. It is replaced after each settled rebuild and is never persisted or used as manuscript authority.

For a disappeared Scene, fallback is the next surviving direct sibling, previous sibling, parent Part, then owning Book. No sibling metadata or file is changed. Restoration uses current metadata and therefore returns naturally to its current parent and sparse key without focus changes.

Selection is reconciled as one service update. A valid Book is retained while an invalid context is cleared or replaced. A missing Book uses only the settled deterministic Book ordering; active-note navigation never establishes Book scope. An author selection made after a pending batch began supersedes that batch's selection effect.

## Explicit unresolved parents

Explicit structural references have strict precedence over legacy folder inference. If an explicit parent cannot resolve, the note remains unresolved. Broken ownership chains are projected in the navigator under **Unresolved manuscript notes** and are never guessed into a Book.

Restoring a Part or Book allows the same current references to resolve again. No child is reparented and no child or sibling key is changed.

## View and editorial policy

Each settled batch clears stale navigator reveal state, refreshes the navigator and Writing Companion, rebuilds affected surviving Book chronology dependencies, and recollects Continuity Review. A deleted selected Book clears or retargets the shared selection so Continuity Review cannot retain private stale scope.

Annotations, chapter notes, pass state and continuity dispositions remain path-associated. Existing non-destructive `deletedAt` presence tracking is retained for compatibility. Same-path manuscript restoration clears that marker but deliberately skips the `open_annotations` frontmatter projection write; restoration itself therefore performs no manuscript write. Non-manuscript restoration retains its existing projection behavior.

## No-write boundary

The integrity coordinator calls no file or structural mutation API. It never creates, deletes, restores, moves or renames a file; never calls `processFrontMatter`; and never reparents, detaches, rekeys or compacts manuscript notes. `type: scene-draft` remains exclusive to the explicit #143 detachment workflow.

The Manuscript Navigator's explicit **Remove Part** and **Remove Book** authoring actions are outside that passive boundary but feed the same event pipeline. After confirmation they call Obsidian's normal trash API for the selected container note only. They perform no frontmatter or order-key write and never delete, detach, reassign or reparent children. Part removal refuses to proceed until every assigned Chapter or Scene has been moved or removed; Book removal refuses to proceed while any Part, Chapter or Scene remains assigned anywhere in that Book. Both operations rebuild current vault truth immediately before trashing and refresh the navigator only after trash succeeds. The resulting deletion and any same-path restoration therefore retain the coordinator's existing editorial-data and reconciliation behaviour.

## FEVER real-vault verification

Completed in the FEVER vault on 25 July 2026 using disposable Scene, Part and Book structures. All cases passed:

- deleting the first, middle and last Scene removed only that Scene from projected order;
- every surviving sibling retained its exact `manuscript_order_key` and SHA-256 file hash;
- navigator fallback followed next sibling, previous sibling, parent Part and owning Book as applicable;
- deleting the active Scene cleared stale Writing Companion chapter state and followed only Obsidian's actual active Markdown note;
- chronology and Continuity Review refreshed without restart;
- same-path Trash restoration returned each Scene to its original parent, sparse key and projected position;
- annotations and other retained editorial data reconnected at the original path, with no editorial identity under `.trash`;
- rapid delete/restore sequences settled on current vault truth without stale fallback or focus theft;
- deleting a Part exposed its child Scenes under **Unresolved manuscript notes**; explicit parent references did not fall through to folder inference and no child was reparented;
- restoring the Part restored containment and cleared the unresolved diagnostics;
- deleting a selected Book reconciled shared Book/context state, and active-note navigation did not establish replacement scope;
- restoring the Book resolved its children without stealing the current Book scope;
- startup reconciliation cleared missing persisted paths and rebuilt current structure without active-note scope inference;
- ordinary non-trash rename migration bypassed deletion fallback, while moves into `.trash` used deletion semantics;
- no plugin-driven manuscript, Story World or file mutation occurred, and no surviving manuscript file changed unexpectedly.
