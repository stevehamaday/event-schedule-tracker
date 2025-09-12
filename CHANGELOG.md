## [1.4.0] - 2025-09-12 ✅ PRODUCTION READY

### Added
- **Premium Azure Deployment**: Successfully deployed to Basic B1 App Service plan
  - **Production URL**: https://showflowapp.azurewebsites.net/ (Basic B1 tier - LIVE)
  - **Performance**: Eliminates 1-2 minute cold start delays - instant response times
  - **Resources**: Dedicated compute resources for consistent, reliable performance
  - **Deployment**: GitHub Actions CI/CD pipeline fully operational
- **Multi-Tier Strategy**: Implemented production/backup deployment architecture
  - **Production**: showflowapp.azurewebsites.net (B1 - always-on, $13-15/month)
  - **Backup**: showflow-clean.azurewebsites.net (Free tier - spins down, $0 when idle)
  - **Benefit**: Zero-cost backup with production-grade primary deployment

### Technical Improvements
- **SCM Basic Authentication**: Properly configured for GitHub Actions deployment
- **App Settings Synchronization**: Copied working configuration from backup to production
- **Publish Profile Management**: Resolved deployment credential issues
- **Build Pipeline**: Stable webpack production builds with React 18.2.0

## [1.3.0] - 2025-09-12

### Added
- **Azure Web App Deployment**: Successfully deployed to Azure App Service with GitHub Actions CI/CD
  - Development URL: https://showflow-clean.azurewebsites.net/
  - Automatic deployment on push to `feature/experimental-fixes` branch
  - Node.js 20 LTS runtime on Linux App Service (Free tier)
- **Persistent Shared Events**: Implemented server-side storage for shared event schedules
  - File-based JSON storage for fast, reliable persistence
  - Events survive server restarts and app downtime
  - Full CRUD API for shared events (/api/events endpoints)
  - Health check endpoint (/api/health) with persistence status
- **Shared Events Frontend**: Complete UI for managing shared schedules
  - "💾 Save as Shared" button to save current schedule as named event
  - "🔄 Refresh List" to reload shared events from server
  - "📥 Load" to restore previously saved schedules
  - "🗑️ Delete" to remove shared events
  - Real-time connection status indicators
  - Event metadata tracking (creation time, last modified, segment count)

### Changed
- **Express Server**: Upgraded from static file server to full API server
  - Added CORS support for cross-origin requests
  - Implemented RESTful API for event management
  - Added comprehensive error handling and logging
  - Serves both static frontend and dynamic API endpoints
- **Package Dependencies**: Established stable build environment
  - React 18.2.0 (stable) instead of bleeding-edge React 19
  - Added webpack build system with proper dependencies
  - Frontend/backend dependency separation
  - Production-ready package.json configuration

### Fixed
- **Critical Frontend Bug**: Resolved "ReferenceError: title is not defined" in shared events
  - Added missing `title` state variable to EventScheduleManager component
  - Fixed saveAsSharedEvent and updateSharedEvent functions
  - Proper error handling and user feedback for shared event operations
- **React Compatibility**: Fixed blank page issues caused by React version conflicts
  - Downgraded from React 19.1.1 to stable React 18.2.0
  - Fixed qrcode.react compatibility (v3.1.0)
  - Resolved JavaScript module loading issues
- **Deployment Pipeline**: Streamlined Azure deployment process
  - Removed conflicting workflow files for deleted resources
  - Fixed GitHub Actions deployment errors (ENOTFOUND issues)
  - Proper SCM authentication and container restart handling

### Security
- **Server Hardening**: Production-ready Express configuration
  - CORS properly configured for security
  - Input validation for API endpoints
  - Safe file system operations with error boundaries
  - No sensitive data exposure in error messages

### Performance
- **Optimized Storage**: Fast local file-based persistence
  - ~1-10ms response times vs 70-400ms for cloud storage
  - Minimal disk usage (~1-5KB per shared event)
  - No network latency for storage operations
  - Automatic data directory creation and initialization

### Deployment
- **Azure Web App Service**: Production deployment infrastructure
  - Resource group: showflow-rg (East US 2)
  - Free tier with 1GB storage, sufficient for application needs
  - GitHub Actions for automated CI/CD on code changes
  - Health monitoring and application insights available

### Developer Experience
- **Build System**: Modern webpack configuration
  - Hot reload for development (`npm run dev`)
  - Production optimization (`npm run build`)
  - Source maps and error tracking
  - Automatic bundle hashing for cache invalidation

## [1.2.5] - 2025-06-11

### Added
- **Bug Reporting**: Added "Report a Bug" button to the desktop footer controls
- Bug report button links to https://aka.ms/sfbugtracker for easy issue submission
- Button positioned to the right of the "Dark Mode" toggle in the bottom control panel

### Changed
- Enhanced footer controls layout to accommodate new bug reporting functionality
- Improved user access to feedback and support channels

## [1.2.4] - 2025-06-10

### Changed
- **UI Improvement**: Improved schedule import header and messaging for better user experience
- Updated main header from "Import or Paste Schedule (Single Day Only*)" to clean "Import or Paste Schedule"
- Added professional subheading with single-day limitation and multi-day roadmap notice
- Enhanced visual hierarchy with proper styling for limitation notice (smaller font, gray color, italic)
- Improved user communication about current capabilities and future roadmap

## [1.2.3] - 2025-06-10

### Added
- Template link integration for schedule format guidance
- Enhanced "Reset All" functionality to clear localStorage and input textarea

### Changed
- Updated button text for creating a schedule to be more user-friendly ("+ Create a New Schedule")
- Added prominent template link (https://aka.ms/showflowtrackertemplate) to help users format their schedules
- Improved reset functionality to provide complete application cleanup

### Fixed
- Reset All button now properly clears all application state including localStorage persistence

## [1.2.2] - 2025-06-06

### Added
- Major mobile UI improvements and responsive design fixes (from experimental-fixes branch merge)
- "Expand All Notes" button now appears only when notes exist and is moved below the "Start New Schedule" button

### Removed
- Lock functionality for schedule segments

### Changed
- Code cleanup and removal of backup files
- All features tested and marked stable

### Fixed
- Responsive design issues on mobile and desktop

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
