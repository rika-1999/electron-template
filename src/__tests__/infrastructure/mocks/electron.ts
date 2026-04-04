import { vi } from 'vitest';
import { createMockMessageChannel } from '../helpers/channelHelpers';

// Singleton mock instances — shared by setup AND test assertions
export const mockApp = {
  on: vi.fn(),
  off: vi.fn(),
  quit: vi.fn(),
  relaunch: vi.fn(),
  exit: vi.fn(),
  getPath: vi.fn((name: string) => `/fake/path/${name}`),
  getName: vi.fn(() => 'TestApp'),
  getVersion: vi.fn(() => '1.0.0'),
  setName: vi.fn(),
  setPath: vi.fn(),
  ready: vi.fn(),
  whenReady: vi.fn(() => Promise.resolve()),
  isReady: vi.fn(() => true),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  dispatch: vi.fn(),
};

export const mockBaseWindow = {
  show: vi.fn(),
  hide: vi.fn(),
  focus: vi.fn(),
  close: vi.fn(),
  destroy: vi.fn(),
  maximize: vi.fn(),
  minimize: vi.fn(),
  restore: vi.fn(),
  isVisible: vi.fn(() => true),
  isFocused: vi.fn(() => false),
  isDestroyed: vi.fn(() => false),
  getBounds: vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
  getContentBounds: vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
  getSize: vi.fn(() => [800, 600]),
  getPosition: vi.fn(() => [0, 0]),
  setSize: vi.fn(),
  setPosition: vi.fn(),
  setMinimumSize: vi.fn(),
  setMaximumSize: vi.fn(),
  setResizable: vi.fn(),
  setFocusable: vi.fn(),
  setEnabled: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  setFullScreen: vi.fn(),
  isFullScreen: vi.fn(() => false),
  isMaximized: vi.fn(() => false),
  isMinimized: vi.fn(() => false),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  contentView: null,
  setContentView: vi.fn(),
  webContents: null,
  setTitle: vi.fn(),
  getTitle: vi.fn(() => 'Test Window'),
  setMenu: vi.fn(),
  setMenuBarVisibility: vi.fn(),
  id: 1,
};

export const mockWebContents = {
  send: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  getURL: vi.fn(() => 'http://localhost:5173'),
  loadURL: vi.fn(() => Promise.resolve()),
  loadFile: vi.fn(() => Promise.resolve()),
  getTitle: vi.fn(() => 'Test Window'),
  getId: vi.fn(() => 1),
  id: 1,
  isLoading: vi.fn(() => false),
  isLoadingMainFrame: vi.fn(() => false),
  isReady: vi.fn(() => true),
  isDestroyed: vi.fn(() => false),
  stop: vi.fn(),
  reload: vi.fn(),
  forceReload: vi.fn(),
  setUserAgent: vi.fn(),
  getUserAgent: vi.fn(() => 'test-user-agent'),
  openDevTools: vi.fn(),
  closeDevTools: vi.fn(),
  close: vi.fn(),
  isDevToolsOpened: vi.fn(() => false),
  print: vi.fn(),
  executeJavaScript: vi.fn(),
};

export const mockIpcMain = {
  handle: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeHandler: vi.fn(),
  removeAllHandlers: vi.fn(),
};

export const mockIpcRenderer = {
  send: vi.fn(),
  sendSync: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

export const mockContextBridge = {
  exposeInMainWorld: vi.fn(),
};

export const mockWebContentsView = {
  webContents: mockWebContents,
  getBounds: vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
  setBounds: vi.fn(),
  setAutoResize: vi.fn(),
  destroy: vi.fn(),
};

export { createMockMessageChannel };

export function createMockElectron() {
  return {
    app: mockApp,
    BaseWindow: vi.fn(() => ({ ...mockBaseWindow })),
    webContents: mockWebContents,
    ipcMain: mockIpcMain,
    ipcRenderer: mockIpcRenderer,
    contextBridge: mockContextBridge,
    MessageChannelMain: vi.fn(() => createMockMessageChannel()),
    WebContentsView: vi.fn(() => ({ ...mockWebContentsView })),
  };
}
