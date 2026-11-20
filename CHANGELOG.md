# CHANGELOG

## 2.7.1

This release has 1 fix and 5 documentation changes. 7 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- **embed:** show HTML files saved in a legacy encoding, such as Windows-1251, correctly

### Documentation

- **readme:** show Obsidian downloads and minimum Obsidian version badges
- **changelog:** make every released entry human-readable
- **changelog:** regroup the published release notes for readers
- make issue attachments optional and strongly encouraged
- link to the Obsidian resources page

## 2.7.0

This release has 1 new feature, 1 fix and 4 documentation changes. 8 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- add a Report a bug command

### Fixed

- **deps:** refresh vulnerable browser testing dependencies

### Documentation

- **readme:** point bug reports at the Report a bug command
- add issue-filing instructions for AI agents
- **readme:** combine related resources and plugin comparisons
- list similar plugins in the README

## 2.6.2

This release has 1 fix and 1 documentation change.

### Fixed

- Move to `@mnaoumov/obsidian-lib` 6, so the plugin keeps working alongside the other plugins built on it.

### Documentation

- The README's Debugging section leads with `Advanced Debug Mode`.

## 2.6.1

This release has 1 new feature and 2 fixes.

### New

- Every "open in external browser" button carries the `embed-html-open-in-external-browser` class, so a CSS snippet can restyle it.

### Fixed

- A remote `![](url)` embed in Live Preview now shows its button above the frame instead of beside it (re #16 - \[FR\] Add support for external links).
- Clicking a remote embed in Live Preview reveals its source, like a vault embed (re #16 - \[FR\] Add support for external links).

## 2.6.0

This release has 1 new feature and 1 documentation change.

### New

- merge remote HTML page embeds (re #16 - \[FR\] Add support for external links)

### Documentation

- **demo-vault:** merge the Settings reference note

## 2.5.10

This release has 4 fixes and 4 documentation changes. 18 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- **test:** merge the headless demo-vault toolkit install
- **deps:** restore the lockfile's missing resolved and integrity fields
- **deps:** float devalue to 5.9.4, clearing GHSA-9rgm-9g3h-6x36
- **build:** wire build:compile to buildCompile and drop the duplicate leaf script

### Documentation

- replace the private rule-id citations with what they assert
- name the library and the sibling plugins so a reader can resolve them
- replace the private tracker references with what they pointed at
- name the unversioned demo-vault asset and the folder it unzips into

## 2.5.9

This release has 2 fixes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **deps:** move to `obsidian-integration-testing` 11 and `obsidian-dev-utils` 96.5.2
- **deps:** drop the brace-expansion file: override that breaks a clean install

## 2.5.8

This release has 2 documentation changes.

### Documentation

- **demo-vault:** unwrap the notes so Obsidian stops rendering a break per line
- **readme:** render the same in Obsidian's plugin page as on `GitHub`

## 2.5.7

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **versions:** correct the stale 1.13.8 minAppVersion row for 2.5.6

## 2.5.6

This release has 3 fixes and 1 documentation change. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- Settings are no longer reset to their defaults while the plugin loads (#15): 2.5.5 could overwrite `.obsidian/plugins/embed-html/data.json` with `{}`. The cause was in `obsidian-dev-utils`, and moving to 94.6.1 picks up its fix. Settings lost that way can usually be restored from `Obsidian Sync` version history, `Obsidian Git` or an OS backup, since the file was overwritten, not deleted.
- override deepmerge-ts to clear GHSA-ggr8-5vv4-36mx
- **test:** restore the demo-vault and linux `vitest` projects

### Documentation

- capture the community-store screenshot set

## 2.5.5

This release has 1 new feature and 1 documentation change.

### New

- **demo-vault:** migrate to `obsidian-dev-utils` 93.3.1 and adopt the authoring convention

### Documentation

- make the demo vault the documentation, in the standard layout

## 2.5.4

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 2.5.3

This release has 1 breaking change and 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Breaking changes

- swap the open-in-default-browser mode for an external-browser button

### New

- load local css

## 2.5.2

This release has 1 new feature and 2 fixes. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- let a single embed override the open-in-default-browser mode

### Fixed

- re-render the embed when a late alt token changes the output mode
- land an anchor jump below a sticky header instead of underneath it

## 2.5.1

This release has 1 new feature and 1 documentation change. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- re #14

### Documentation

- point at the collapsed cross-platform test file names

## 2.5.0

This release has 1 documentation change. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Documentation

- fix the demo vault download instructions

## 2.4.0

This release has 1 documentation change. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Documentation

- demo embedding HTML by relative and full path (re #4)

## 2.3.0

This release has 1 new feature and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- \[FR\] Add border and background to embedded HTML file (#5)

### Documentation

- demo embed appearance settings in the demo vault (re #5)

## 2.2.6

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- \[Bug\] JavaScript doesn't execute on Android — (#9)

## 2.2.5

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 2.2.4

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- apply numeric embed width when Obsidian resets alt to the file name

## 2.2.3

This release has maintenance changes only. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 2.2.2

This release has 1 fix.

### Fixed

- demo vault

## 2.2.1

This release has 1 new feature and 1 documentation change.

### New

- ship the demo vault in-repo

### Documentation

- demo vault

## 2.2.0

This release has 1 new feature.

### New

- Please add setting to open HTML files in a new tab by default (#13)

## 2.1.1

This release has maintenance changes only. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 2.1.0

This release has 1 new feature.

### New

- propagate Obsidian color scheme to embedded HTML re #11

## 2.0.1

This release has 1 fix. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- keep embeds rendered after scrolling out of view and back

## 2.0.0

This release has 1 new feature. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- re #12 #6

## 1.1.12

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.1.11

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.1.10

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.1.9

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.1.8

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.1.7

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.1.6

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.1.5

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.1.4

This release has maintenance changes only. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 1.1.3

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- build

## 1.1.2

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 1.1.1

This release has 1 other change.

### Other changes

- Fix `Excalidraw` rendering without id

## 1.1.0

This release has 3 other changes.

### Other changes

- Make all links open to blank
- Add support for subpath (#1)
- Add support for `Excalidraw` (#2)

## 1.0.2

- Minor changes

## 1.0.1

- Minor changes

## 1.0.0

This release has 1 other change.

### Other changes

- Initial implementation
