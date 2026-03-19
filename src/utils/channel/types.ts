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
