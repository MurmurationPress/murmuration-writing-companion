# Murmuration Writing Companion 0.18.0

## Highlights

MWC 0.18.0 makes editing and navigation noticeably faster in large manuscripts, connects manuscript context more coherently with Story World, renders manuscript chat itself, makes author Help easy to find, and introduces a safer self-configuring Git vault backup.

## Writing and manuscript workflow

- Long Scenes stay more responsive because ordinary keystrokes perform less companion work.
- Chapter Context now presents resolved POV and Scene Location as semantic Story World links without exposing raw wikilinks or paths.
- Selecting a recognised Story World Location keeps `location` as the sole authored Scene property and derives World Context without duplicating it into `world_context`.
- Continuity Review keeps persisted findings inspectable and now presents the correct action for findings already marked Intentional.

## Story World

- The focused Graph gains an evidence-based temporal mode for exploring what changes, when it changes, and what a reader or entity can know.
- References have a dedicated Navigator category, local citation/DOI import and reusable vault- or Book-scoped projections.
- Newly authored unresolved manuscript links can create the appropriate Story World entity type with explicit provenance and collision safeguards.
- MWC-owned context, impact, inspector and selection surfaces consistently show clean semantic names and resolved navigation.

## Performance

MWC performs less work on ordinary keystrokes, behaves better in long Scenes, and reuses settled manuscript and Story World projections across navigation and review surfaces. Startup and runtime avoid duplicated work, while the production bundle is minified and kept within an enforced release budget.

## Manuscript chat

MWC now renders canonical manuscript chat blocks itself; the external Chat View plugin is no longer required. Chat bodies support Markdown, wikilinks and local embedded images while retaining the same authored block syntax. Arbitrary transclusion and unrelated plugin rendering inside chat bodies are not implied.

## Help

Task-oriented author Help and detailed property/reference material are available through:

- **Command Palette → Open Help**
- **Settings → Murmuration Writing Companion → Help → Open Help**

## Vault backup

Desktop Linux and Windows authors can back up a Git-managed vault without maintaining a Bash script. MWC detects the current vault repository and branch, selects `origin` or the sole remote automatically, and lets you choose when several non-`origin` remotes are available. **Check backup configuration** verifies readiness before backup.

MWC uses the machine's existing Git authentication and never stores credentials. It will not install Git, create accounts or remote repositories, create SSH keys, or manage credentials. For safety it refuses automatic pull, merge, rebase, branch switching, force-push and conflict resolution; remote-ahead or divergent histories must be resolved with Git outside MWC. Existing vault-local backup scripts remain untouched.

## Fixed

- Continuity Review no longer shows an active **Mark intentional** action for an already-Intentional finding; the existing **Return to unresolved** action is shown instead.

## Upgrade

For a manual upgrade, replace all three plugin files together:

- `main.js`
- `manifest.json`
- `styles.css`
