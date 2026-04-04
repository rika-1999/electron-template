import { WebContentsView } from 'electron';
import { TypedEmitter } from '@/utils/typedEmitter';
import { Channel } from '@/shared/channel';
import type { ViewState, ViewType, ManagedViewEventMap } from '@/shared/view';
import type { ManagedView as IManagedView } from './types';

export class ManagedView extends TypedEmitter<ManagedViewEventMap> implements IManagedView {
  readonly id: string;
  readonly type: ViewType;
  readonly url: string;
  readonly webContentsView: WebContentsView;
  readonly channel: Channel;
  hostWindow: Electron.BrowserWindow | Electron.BaseWindow | null = null;

  private _loaded = false;
  private webContentsSubscriptions: Array<() => void> = [];

  constructor(
    id: string,
    options: { url: string; type: ViewType; channel?: Channel; preload?: string },
  ) {
    super();
    this.id = id;
    this.type = options.type;
    this.url = options.url;

    const webPreferences: Electron.WebPreferences = {
      contextIsolation: true,
      nodeIntegration: false,
      ...(options.type === 'background' && { offscreen: true }),
      ...(options.preload && { preload: options.preload }),
    };

    this.webContentsView = new WebContentsView({ webPreferences });

    this.channel = options.channel ?? new Channel();

    this.setupWebContentsListeners();
  }

  private subscribeToWebContents(event: string, handler: (...args: unknown[]) => void): void {
    const wc = this.webContentsView.webContents;
    const subscription = () => {
      // @ts-expect-error - Electron types are strict about event names
      wc.off(event, handler);
    };
    this.webContentsSubscriptions.push(subscription);
    // @ts-expect-error - Electron types are strict about event names
    wc.on(event, handler);
  }

  private setupWebContentsListeners(): void {
    const finishLoadHandler = () => {
      this._loaded = true;
      this.emit('ready');
      this.emit('state-changed', this.state);
    };
    const focusHandler = () => this.emit('state-changed', this.state);
    const blurHandler = () => this.emit('state-changed', this.state);

    this.subscribeToWebContents('did-finish-load', finishLoadHandler);
    this.subscribeToWebContents('focus', focusHandler);
    this.subscribeToWebContents('blur', blurHandler);
  }

  async load(): Promise<void> {
    await this.webContentsView.webContents.loadURL(this.url);
  }

  async initChannel(): Promise<void> {
    await this.channel.init({ webContentsId: this.webContentsView.webContents.id });
  }

  attachTo(
    window: Electron.BrowserWindow | Electron.BaseWindow,
    bounds?: Electron.Rectangle,
  ): void {
    this.detach();
    (window.contentView as { addChildView: (v: unknown) => void }).addChildView(
      this.webContentsView,
    );
    this.hostWindow = window;
    if (bounds) {
      this.webContentsView.setBounds(bounds);
    }
    this.emit('state-changed', this.state);
  }

  detach(): void {
    if (this.hostWindow) {
      const contentView = this.hostWindow.contentView as {
        removeChildView?: (v: unknown) => void;
      };
      contentView.removeChildView?.(this.webContentsView);
      this.hostWindow = null;
      this.emit('state-changed', this.state);
    }
  }

  toggleDevTools(): void {
    const wc = this.webContentsView.webContents;
    if (wc.isDevToolsOpened()) {
      wc.closeDevTools();
    } else {
      wc.openDevTools({ mode: 'detach' });
    }
  }

  get state(): ViewState {
    const wc = this.webContentsView.webContents;
    const isDestroyed = wc.isDestroyed();
    return {
      id: this.id,
      type: this.type,
      url: this.url,
      bounds: this.type === 'background' ? null : this.webContentsView.getBounds(),
      visible: this.type !== 'background' && !isDestroyed,
      focused: !isDestroyed && wc.isFocused?.() === true,
      loaded: this._loaded,
    };
  }

  destroy(): void {
    this.detach();

    this.webContentsSubscriptions.forEach((unsub) => unsub());
    this.webContentsSubscriptions = [];

    this.removeAllListeners();

    this.channel.destroy();
    const wc = this.webContentsView.webContents;
    if (!wc.isDestroyed()) {
      wc.close();
    }
  }
}
