## [1.0.9] - 2025-05-30

### Added
- Implemented new session adjustment logic in `SessionAdjuster.js` for more flexible event timing.
- Added notification sound and visual alert integration for upcoming events.
- Robust drag-and-drop reordering of schedule segments with automatic time recalculation.
- Inline editing, duplication, addition, and removal of schedule segments.
- Undo/redo functionality for schedule changes.
- Import schedules via pasted text or Excel/CSV upload, with flexible column mapping.
- Alert/notification scheduling for selected segments, including in-app toast and audio alerts.
- Accessibility improvements: dark/light mode toggle, adjustable font size, and high-contrast mode.
- Schedule export with Excel (XLSX) download.
- Presenter view data sharing via localStorage.
- Keyboard shortcuts for common actions (undo, redo, add segment, help).
- Summary tracking of all schedule changes and actions.

### Changed
- Improved UI responsiveness and layout in `EventList.js` and `PresenterView.js`.
- Refactored `excelParser.js` for better error handling and Excel compatibility.
- Updated asset references to ensure consistent loading in both dev and production environments.

### Fixed
- Resolved issues with event time calculations and countdown timer accuracy.
- Fixed broken image links and missing style references in several components.
- Addressed minor bugs in event import/export workflow.

## [1.1.0] - 2025-06-02

### Changed
- Migrated all static assets and `index.html` from `public/` to `docs/` to support GitHub Pages deployment.
- Updated asset references and import paths in code and HTML to use relative paths for compatibility with GitHub Pages.
- Updated `webpack.config.js`:
  - `output.path` now points to `docs/scripts` for production builds.
  - `devServer.contentBase` uses `public/` for local development.
- Ensured `public/styles/main.css` exists for local dev and is copied to `docs/styles/main.css` for deployment.
- Fixed logo image paths in React components from absolute (`/styles/...`) to relative (`styles/...`) for correct display on GitHub Pages.

### Deployment
- To deploy, run `npm run build` and push changes. Set GitHub Pages source to `/docs` in repository settings.

---

Older entries can be added below as you gather more project history.
