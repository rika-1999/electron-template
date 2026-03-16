export interface ChannelRequest {
  id: string
  type: 'request'
  method: string
  payload?: unknown
}

export interface ChannelResponse {
  id: string
  type: 'response'
  payload?: unknown
  error?: string
}

export type ChannelMessage = ChannelRequest | ChannelResponse

export interface ChannelAPI {
  request(method: string, payload?: unknown): Promise<unknown>
  on(method: string, handler: (payload: unknown) => Promise<unknown> | unknown): void
  off(method: string): void
}

declare global {
  interface Window {
    channel: ChannelAPI
  }
}
