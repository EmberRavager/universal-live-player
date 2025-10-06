// 视频流类型枚举
export enum StreamType {
  WEBRTC = 'webrtc',
  ZLM_RTC = 'zlm_rtc',
  RTMP = 'rtmp',
  RTSP = 'rtsp',
  GB28181 = 'gb28181',
  HLS = 'hls',
  FLV = 'flv'
}

// 播放器状态
export enum PlayerStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  PLAYING = 'playing',
  PAUSED = 'paused',
  ERROR = 'error',
  STOPPED = 'stopped'
}

// 播放器配置接口
export interface PlayerConfig {
  url?: string
  type?: StreamType
  autoplay?: boolean
  muted?: boolean
  controls?: boolean
  width?: number | string
  height?: number | string
  poster?: string
  // 多视频流配置
  multiStream?: MultiStreamConfig
  // 是否启用多流模式
  enableMultiStream?: boolean
}

// 播放器事件接口
export interface PlayerEvents {
  onPlay?: () => void
  onPause?: () => void
  onStop?: () => void
  onError?: (error: Error) => void
  onLoadStart?: () => void
  onLoadEnd?: () => void
  onTimeUpdate?: (currentTime: number) => void
  onVolumeChange?: (volume: number) => void
  onStreamSwitch?: (streamId: string) => void
}

// 视频流配置接口
export interface StreamConfig {
  id: string
  name: string
  url: string
  type: StreamType
  poster?: string
  enabled?: boolean
}

// 多视频流配置接口
export interface MultiStreamConfig {
  streams: StreamConfig[]
  defaultStreamId?: string
  autoSwitch?: boolean
  switchDelay?: number
}

// 截图配置
export interface ScreenshotConfig {
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number
  width?: number
  height?: number
}

// 抽帧配置
export interface FrameExtractConfig {
  interval?: number // 抽帧间隔（秒）
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number
  maxFrames?: number
}

// 播放器实例接口
export interface IPlayer {
  play(): Promise<void>
  pause(): void
  stop(): void
  refresh(): void
  setVolume(volume: number): void
  getVolume(): number
  getCurrentTime(): number
  getDuration(): number
  getStatus(): PlayerStatus
  screenshot(config?: ScreenshotConfig): Promise<string>
  startFrameExtract(config?: FrameExtractConfig): void
  stopFrameExtract(): void
  destroy(): void
  // 多视频流管理方法
  switchStream?(streamId: string): Promise<void>
  getCurrentStreamId?(): string | null
  getAvailableStreams?(): StreamConfig[]
  addStream?(stream: StreamConfig): void
  removeStream?(streamId: string): void
}

// WebRTC 播放器配置
export interface WebRTCConfig {
  iceServers?: RTCIceServer[]
  constraints?: MediaStreamConstraints
}

// RTMP/RTSP 播放器配置
export interface StreamingConfig {
  username?: string
  password?: string
  timeout?: number
  reconnectAttempts?: number
  reconnectDelay?: number
}

// 播放器选项
export interface PlayerOptions {
  container: HTMLElement | string
  config: PlayerConfig
  events?: PlayerEvents
  webrtcConfig?: WebRTCConfig
  streamingConfig?: StreamingConfig
}

// 错误类型
export interface PlayerError {
  code: string
  message: string
  details?: any
}

// 播放统计信息
export interface PlaybackStats {
  bitrate?: number
  fps?: number
  resolution?: { width: number; height: number }
  codec?: string
  latency?: number
  packetLoss?: number
}

// ZLM RTC 事件类型
export interface ZLMRTCEvents {
  WEBRTC_NOT_SUPPORT: 'WEBRTC_NOT_SUPPORT'
  WEBRTC_ICE_CANDIDATE_ERROR: 'WEBRTC_ICE_CANDIDATE_ERROR'
  WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED: 'WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED'
  WEBRTC_ON_REMOTE_STREAMS: 'WEBRTC_ON_REMOTE_STREAMS'
  WEBRTC_ON_LOCAL_STREAM: 'WEBRTC_ON_LOCAL_STREAM'
  WEBRTC_ON_CONNECTION_STATE_CHANGE: 'WEBRTC_ON_CONNECTION_STATE_CHANGE'
  WEBRTC_ON_DATA_CHANNEL_OPEN: 'WEBRTC_ON_DATA_CHANNEL_OPEN'
  WEBRTC_ON_DATA_CHANNEL_CLOSE: 'WEBRTC_ON_DATA_CHANNEL_CLOSE'
  WEBRTC_ON_DATA_CHANNEL_ERR: 'WEBRTC_ON_DATA_CHANNEL_ERR'
  WEBRTC_ON_DATA_CHANNEL_MSG: 'WEBRTC_ON_DATA_CHANNEL_MSG'
  CAPTURE_STREAM_FAILED: 'CAPTURE_STREAM_FAILED'
}

// ZLM RTC 配置选项
export interface ZLMRTCOptions {
  element: HTMLVideoElement
  debug?: boolean
  zlmsdpUrl: string
  simulcast?: boolean
  useCamera?: boolean
  audioEnable?: boolean
  videoEnable?: boolean
  recvOnly?: boolean
  resolution?: { w: number; h: number }
  usedatachannel?: boolean
  videoId?: string
  audioId?: string
}

// ZLM RTC 客户端接口
export interface ZLMRTCEndpoint {
  on(event: keyof ZLMRTCEvents, callback: (data?: any) => void): void
  close(): void
  play(): void
  stop(): void
}

// 全局类型声明
declare global {
  interface Window {
    // SRS SDK 相关
    SrsError: any
    SrsRtcPublisherAsync: any
    SrsRtcPlayerAsync: any
    SrsRtcWhipWhepAsync: any
    SrsRtcFormatSenders: any
    
    // ZLM RTC 相关
    ZLMRTCClient: {
      Endpoint: new (options: ZLMRTCOptions) => ZLMRTCEndpoint
      Events: ZLMRTCEvents
    }
    
    // flv.js 相关
    flvjs: any
    
    // hls.js 相关
    Hls: any
  }
}