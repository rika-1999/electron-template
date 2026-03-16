## ADDED Requirements

### Requirement: ChannelInstance class
`channel.ts` SHALL export a `ChannelInstance` class that encapsulates all channel state (port, handlers, pending requests) as instance members instead of module-level globals.

#### Scenario: Create multiple independent channel instances
- **WHEN** two `ChannelInstance` objects are created and each calls `setupMain(webContentsId)` with different webContents
- **THEN** each instance maintains its own independent port, handlers, and pending maps, and messages on one instance do not affect the other

#### Scenario: Destroy a channel instance
- **WHEN** `destroy()` is called on a ChannelInstance
- **THEN** the port is closed, all pending requests are rejected, and all handlers are cleared

---

### Requirement: Backward-compatible default channel export
The `channel` export from `channel.ts` SHALL remain a plain object with `init`, `request`, `on`, `off` methods that delegate to a default `ChannelInstance`, preserving the existing API for the main window.

#### Scenario: Existing main window channel usage unchanged
- **WHEN** existing code calls `channel.init({ webContentsId })`, `channel.on(method, handler)`, `channel.request(method, payload)`
- **THEN** the behavior SHALL be identical to the pre-refactor implementation

#### Scenario: Existing preload channel usage unchanged
- **WHEN** existing preload code calls `channel.init()`
- **THEN** the behavior SHALL be identical to the pre-refactor implementation (sets up renderer-side port via ipcRenderer)

#### Scenario: Existing renderer channel usage unchanged
- **WHEN** existing renderer code calls `channel.request(method, payload)` or `channel.on(method, handler)`
- **THEN** the calls SHALL delegate to `window.channel` as before
