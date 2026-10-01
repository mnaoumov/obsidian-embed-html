# CHANGELOG

## 2.6.1

- Fix: a remote `![](url)` embed in Live Preview now shows its button above the frame instead of beside it.
- Fix: clicking a remote embed in Live Preview reveals its source, like a vault embed.
- Every "open in external browser" button carries the `embed-html-open-in-external-browser` class, so a CSS snippet can restyle it.

## 2.6.0

- docs(demo-vault): merge the Settings reference note
- feat: merge remote HTML page embeds

## 2.5.10

- chore: merge the applyObsidianTheme move for the desktop capture suite
- chore(deps): merge the obsidian-integration-testing 17 float
- chore(deps): merge the obsidian-test-mocks 7 float
- fix(test): merge the headless demo-vault toolkit install
- fix(deps): restore the lockfile's missing resolved and integrity fields
- style(comments): stop rewriting symbol names that open a comment
- test(vitest-config): run the location-stubbing suite on the default pool
- build(markdownlint): forbid hard-wrapped markdown paragraphs
- test: size the open-in-new-tab closure's shared wait ceiling
- fix(deps): float devalue to 5.9.4, clearing GHSA-9rgm-9g3h-6x36
- test: give the capture suites' open-note closures room inside the per-eval cap
- chore(deps): drop the dead markdown-it override
- chore(deps): drop the dead js-yaml override
- style(comments): stop capitalizing the middle of a wrapped comment
- docs: replace the private rule-id citations with what they assert
- docs: name the library and the sibling plugins so a reader can resolve them
- docs: replace the private tracker references with what they pointed at
- test: keep the embed suites' declared waiting under the transport cap
- chore(deps): move to obsidian-dev-utils 103
- test: bring the in-closure wait ceilings under the transport's per-eval cap
- chore: adopt the npm run gate branch gate
- test: bring the in-closure wait ceiling under the transport's per-eval cap
- docs: name the unversioned demo-vault asset and the folder it unzips into
- chore: make the LICENSE copyright line checkable by the linter and guard it against the year roll-over
- test(test-mocks): drop the hand-rolled app.plugins stub, and sweep the dependencies
- fix(build): wire build:compile to buildCompile and drop the duplicate leaf script

## 2.5.9

- chore(deps): sweep caret-ranged dependencies to latest
- fix(deps): move to obsidian-integration-testing 11 and obsidian-dev-utils 96.5.2
- fix(deps): drop the brace-expansion file: override that breaks a clean install

## 2.5.8

- docs(demo-vault): unwrap the notes so Obsidian stops rendering a break per line
- docs(readme): render the same in Obsidian's plugin page as on GitHub

## 2.5.7

- fix(versions): correct the stale 1.13.8 minAppVersion row for 2.5.6
- chore: update libs

## 2.5.6

- chore: update obsidian-dev-utils to 94.6.1
- chore: update obsidian-dev-utils to 94.6.0
- fix: override deepmerge-ts to clear GHSA-ggr8-5vv4-36mx
- test: gate the demo vault by clicking every code button
- fix(test): restore the demo-vault and linux vitest projects
- chore: teach cspell the advisory wording
- chore: update libs
- docs: capture the community-store screenshot set

## 2.5.5

- docs: make the demo vault the documentation, in the standard layout
- feat(demo-vault): migrate to obsidian-dev-utils 93.3.1 and adopt the authoring convention

## 2.5.4

- chore: update libs and adopt obsidian-integration-testing 10

## 2.5.3

- chore: find underexposed
- feat!: swap the open-in-default-browser mode for an external-browser button
- feat: load local css

## 2.5.2

- chore: teach cspell the word screenful
- fix: re-render the embed when a late alt token changes the output mode
- test: make the sticky-header case actually reproduce, and measure the laid-out embed
- fix: land an anchor jump below a sticky header instead of underneath it
- feat: let a single embed override the open-in-default-browser mode

## 2.5.1

- chore: update libs
- feat: re #14
- chore: update libs
- docs: point at the collapsed cross-platform test file names
- chore(vitest): consume the shared vitest configuration and collapse the shared suites

## 2.5.0

- refactor(settings): move the settings tab onto the declarative settings API
- chore: update libs and clear the npm audit
- docs: fix the demo vault download instructions
- ci: run Linux integration on Node 24 (npm 11) and bump actions (re #4)

## 2.4.0

- ci: add Linux integration workflow for path-resolution embeds (re #4)
- docs: demo embedding HTML by relative and full path (re #4)
- test: verify embedding HTML by relative and full vault path (re #4)

## 2.3.0

- docs: demo embed appearance settings in the demo vault (re #5)
- test: add behavioral integration test for embed appearance settings (re #5)
- feat: re #5

## 2.2.6

- fix: re #9
- chore: update libs

## 2.2.5

- chore: update libs

## 2.2.4

- chore: update libs
- fix: apply numeric embed width when Obsidian resets alt to the file name

## 2.2.3

- chore(demo-vault): drop committed Invocables placeholder
- chore(demo-vault): add Invocables folder for consistency
- test: validate rendered embed sizes in the demo vault

## 2.2.2

- fix: demo vault

## 2.2.1

- docs: demo vault
- feat: ship the demo vault in-repo

## 2.2.0

- feat: re #113

## 2.1.1

- chore: update libs
- chore: update obsidian-dev-utils to 85.0.0
- refactor: pass params objects to sizing helpers

## 2.1.0

- feat: propagate Obsidian color scheme to embedded HTML re #11

## 2.0.1

- chore: spellcheck
- test: cover reading-view scroll re-render on android too
- fix: keep embeds rendered after scrolling out of view and back

## 2.0.0

- feat: re #12 #6
- test: wire integration-testing vitest-setup into integration projects
- chore: update libs
- chore: clean up tsconfig

## 1.1.12

- refactor: new template

## 1.1.11

- chore: update libs

## 1.1.10

- chore: update template

## 1.1.9

- refactor: new template

## 1.1.8

- chore: update template

## 1.1.7

- chore: update libs

## 1.1.6

- chore: update libs

## 1.1.5

- chore: update libs

## 1.1.4

- chore: update libs
- chore: lint
- chore: enable markdownlint

## 1.1.3

- fix: build
- fix: build
- fix: build
- chore: update libs

## 1.1.2

- chore: enable conventional commits

## 1.1.1

- Fix Excalidraw rendering without id

## 1.1.0

- Make all links open to blank
- Add support for subpath (#1)
- Add support for Excalidraw (#2)

## 1.0.2

- Minor changes

## 1.0.1

- Minor changes

## 1.0.0

- Initial implementation
