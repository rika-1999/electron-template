## ADDED Requirements

### Requirement: Create views with different modes
ViewManager SHALL support creating WebContentsView instances in three modes: `embedded` (attached to a BrowserWindow), `detached` (hosted in a new BaseWindow), and `background` (not attached to any window, no rendering).

#### Scenario: Create an embedded view
- **WHEN** `createView({ url, type: 'embedded', parentWindow, bounds })` is called
- **THEN** a WebContentsView is created, attached to the parentWindow's contentView at the specified bounds, loads the given URL with the view preload, and returns a unique viewId

#### Scenario: Create a detached view
- **WHEN** `createView({ url, type: 'detached', windowOptions })` is called
- **THEN** a new BaseWindow is created with the given options, a WebContentsView is set as its contentView, loads the given URL with the view preload, and returns a unique viewId

#### Scenario: Create a background view
- **WHEN** `createView({ url, type: 'background' })` is called
- **THEN** a WebContentsView is created without attaching to any window, loads the given URL with the view preload, and returns a unique viewId

#### Scenario: Default view type
- **WHEN** `createView({ url, parentWindow })` is called without specifying `type`
- **THEN** the view SHALL be created as `embedded` type

---

### Requirement: Destroy views with cleanup
ViewManager SHALL destroy a view and release all associated resources (channel, event listeners, webContents) when `destroyView(viewId)` is called.

#### Scenario: Destroy an existing view
- **WHEN** `destroyView(viewId)` is called for an existing view
- **THEN** the view's channel is destroyed, webContentsView is removed from its host window (if any), webContents is destroyed, and the view is removed from the internal registry

#### Scenario: Destroy a non-existent view
- **WHEN** `destroyView(viewId)` is called with an unknown viewId
- **THEN** the call SHALL be a no-op (no error thrown)

---

### Requirement: Query view state
ViewManager SHALL provide methods to query the current state of any managed view.

#### Scenario: Get single view state
- **WHEN** `getView(viewId)` is called for an existing view
- **THEN** it returns a ManagedView object containing the view's id, type, url, bounds (null for background), visible, focused, and loaded status

#### Scenario: Get non-existent view state
- **WHEN** `getView(viewId)` is called with an unknown viewId
- **THEN** it returns `undefined`

#### Scenario: List all views
- **WHEN** `listViews()` is called
- **THEN** it returns an array of ViewState for all currently managed views

---

### Requirement: Attach and detach views between windows
ViewManager SHALL support moving views between embedded and detached modes.

#### Scenario: Attach a view to a window
- **WHEN** `attachToWindow(viewId, browserWindow, bounds)` is called
- **THEN** the view is removed from its current host (if any), added to the target BrowserWindow's contentView at the specified bounds, and its type becomes `embedded`

#### Scenario: Detach a view to an independent window
- **WHEN** `detachToWindow(viewId, windowOptions)` is called
- **THEN** the view is removed from its current host (if any), a new BaseWindow is created, the view is set as its contentView, the type becomes `detached`, and the BaseWindow is returned

---

### Requirement: Lifecycle events
ViewManager SHALL emit lifecycle events for view state changes.

#### Scenario: View created event
- **WHEN** a view is successfully created via `createView()`
- **THEN** a `view-created` event is emitted with the viewId and initial ViewState

#### Scenario: View destroyed event
- **WHEN** a view is destroyed via `destroyView()`
- **THEN** a `view-destroyed` event is emitted with the viewId

#### Scenario: View state changed event
- **WHEN** a view's state changes (show, hide, resize, focus, blur, bounds-changed)
- **THEN** a `view-state-changed` event is emitted with the viewId and updated ViewState

#### Scenario: View ready event
- **WHEN** a view's webContents finishes loading (`did-finish-load`)
- **THEN** a `view-ready` event is emitted with the viewId

---

### Requirement: Built-in channel communication
ViewManager SHALL provide built-in channel methods for communicating with managed views.

#### Scenario: Send request to a specific view
- **WHEN** `requestTo(viewId, method, payload)` is called
- **THEN** the request is sent via the view's ChannelInstance and the response promise is returned

#### Scenario: Broadcast to all views
- **WHEN** `broadcast(method, payload)` is called
- **THEN** the request is sent to all active views' channels

#### Scenario: Listen for messages from a specific view
- **WHEN** `onMessage(viewId, method, handler)` is called
- **THEN** the handler is registered on the specified view's ChannelInstance

#### Scenario: Listen for messages from any view
- **WHEN** `onAnyMessage(method, handler)` is called
- **THEN** the handler is registered for the given method on all current and future views, receiving the source viewId as the first argument

#### Scenario: Request to non-existent view
- **WHEN** `requestTo(viewId, method, payload)` is called with an unknown viewId
- **THEN** the promise SHALL reject with an error indicating the view does not exist
