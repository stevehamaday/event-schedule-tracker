## [1.2.1] - 2025-06-05

### Fixed
- **Critical Fix**: Resolved start time parsing issue where uploaded/pasted schedules always reverted to 9:00 AM start time
- Modified `recalculateTimes` function in `EventScheduleManager.js` to preserve original start times from uploaded CSV/Excel files
- Changed function parameter from `eventStartTime = '09:00 AM'` to `eventStartTime = null` to detect and use actual start times
- Added logic to check first segment for existing time data before falling back to default 9:00 AM
- Now correctly preserves uploaded start times (e.g., 8:30 AM) while maintaining all existing drag-and-drop and editing functionality

### Changed
- Improved parsing logic to be more intelligent about preserving user-provided time data
- Enhanced time recalculation system to respect original schedule timing while still allowing manual edits

### Deployment
- Built and deployed to GitHub Pages with fixed parsing logic
- Verified compatibility with existing React functionality including drag-and-drop, segment editing, and time recalculation

## [1.2.0] - 2025-06-02

### Added
- Major mobile experience improvements: responsive layout, mobile navigation (hamburger menu), floating action button (FAB) for adding segments, and touch-friendly controls.
- All mobile enhancements are isolated to screens 768px wide or less; desktop/regular view is unchanged.
- Larger touch targets, improved font sizing, and swipe/drag cues for mobile users.
- Accessibility improvements for mobile: larger tap targets, better contrast, and mobile-friendly toast notifications.

### Changed
- Updated `docs/styles/main.css` and `public/styles/main.css` to include mobile-only CSS using `@media (max-width: 768px)`.
- Updated `EventScheduleManager.js` to render mobile navigation and FAB only on mobile devices.
- No changes to desktop layout or features.

### Deployment
- After pushing these changes, test the site on a mobile device or emulator to verify the new mobile experience.

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
