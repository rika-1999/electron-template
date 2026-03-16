## ADDED Requirements

### Requirement: Separate preload entry for sub-views
A dedicated preload script (`src/preload/view.ts`) SHALL exist for all sub-views, separate from the main window preload (`src/preload/index.ts`).

#### Scenario: Sub-view loads with view preload
- **WHEN** ViewManager creates a WebContentsView
- **THEN** the view's webPreferences.preload SHALL point to `dist/preload-view/index.js`

#### Scenario: Main window preload unchanged
- **WHEN** the main BrowserWindow is created
- **THEN** its webPreferences.preload SHALL still point to `dist/preload/index.js` (unchanged)

---

### Requirement: View preload exposes channel API
The view preload SHALL use `contextBridge.exposeInMainWorld` to expose a `channel` API to the renderer context.

#### Scenario: Channel API available in view renderer
- **WHEN** a sub-view's renderer code accesses `window.channel`
- **THEN** it SHALL have `request(method, payload)`, `on(method, handler)`, and `off(method)` methods available

---

### Requirement: View preload build configuration
A Vite build configuration (`vite.config.preload-view.ts`) SHALL build the view preload as a separate artifact.

#### Scenario: Build produces view preload artifact
- **WHEN** the build process runs
- **THEN** `dist/preload-view/index.js` SHALL be generated as a CJS module

#### Scenario: PROCESS_TYPE is set to preload
- **WHEN** the view preload is built
- **THEN** `process.env.PROCESS_TYPE` SHALL be defined as `'preload'` at build time

---

### Requirement: View preload path utility
`paths.ts` SHALL provide a method to get the view preload path.

#### Scenario: Get view preload path
- **WHEN** `paths.getViewPreloadPath()` is called
- **THEN** it returns the absolute path to `dist/preload-view/index.js`
