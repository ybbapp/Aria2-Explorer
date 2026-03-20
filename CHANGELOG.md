# Changelog

## [2.7.9] - 2026-03-20

### Fixed
- **AriaNG config sync**: When RPC config is saved in the options page, all open AriaNG tabs now automatically receive the updated config via `scripting.executeScript` and reload — no manual refresh needed
- **AriaNG config sync**: Background service worker independently syncs localStorage to AriaNG tabs, so the sync works even when the options page is closed
- **CSP**: Added `unsafe-eval` to extension page Content Security Policy to allow AngularJS template compilation in AriaNG
- **Firefox compatibility**: Guard `navigator.unregisterProtocolHandler` call with a `typeof` check — the API is not available in Firefox, causing an uncaught TypeError when disabling magnet capture

### Changed
- Added `console.debug` trace logs to key config flow points (save, upload, download, AriaNG sync, RPC server selection, download capture) to aid debugging

## [2.7.8] - 2026-03-19

### Changed
- Bumped version to 2.7.8
- Read version dynamically from package.json

### Fixed
- Cloud sync improvements
- Firefox cross-container support
