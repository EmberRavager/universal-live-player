/**
 * 全局播放器配置管理模块
 * 统一管理所有播放器设置、预设配置和运行时参数
 * 
 * 作者：代码侠 - 让配置管理像调音台一样优雅 🎛️
 */

import { StreamType, PlayerConfig, MultiStreamConfig } from '@/types'

// 播放器预设配置类型
export interface PlayerPreset {
  name: string
  description: string
  config: Partial<PlayerConfig>
  rtcConfig?: RTCConfiguration
  performance: {
    priority: 'quality' | 'latency' | 'bandwidth'
    bufferSize?: number
    maxRetries?: number
  }
}

// 全局配置接口
export interface GlobalPlayerConfig {
  // 基础设置
  defaultWidth: number
  defaultHeight: number
  autoplay: boolean
  muted: boolean
  showControls: boolean
  showStats: boolean
  
  // 性能设置
  enableHardwareAcceleration: boolean
  maxConcurrentStreams: number
  bufferSize: number
  
  // 网络设置
  maxRetries: number
  retryDelay: number
  connectionTimeout: number
  
  // UI设置
  theme: 'light' | 'dark' | 'auto'
  controlsTimeout: number
  showCarousel: boolean
  
  // 调试设置
  enableDebugLogs: boolean
  enablePerformanceMonitor: boolean
}

// 默认全局配置
export const DEFAULT_GLOBAL_CONFIG: GlobalPlayerConfig = {
  // 基础设置
  defaultWidth: 800,
  defaultHeight: 550,
  autoplay: true,
  muted: true,
  showControls: true,
  showStats: false,
  
  // 性能设置
  enableHardwareAcceleration: true,
  maxConcurrentStreams: 4,
  bufferSize: 3,
  
  // 网络设置
  maxRetries: 3,
  retryDelay: 2000,
  connectionTimeout: 10000,
  
  // UI设置
  theme: 'auto',
  controlsTimeout: 3000,
  showCarousel: true,
  
  // 调试设置
  enableDebugLogs: false,
  enablePerformanceMonitor: false
}

// 播放器预设配置
export const PLAYER_PRESETS: Record<string, PlayerPreset> = {
  // 低延迟模式 - 适合实时互动
  lowLatency: {
    name: '低延迟模式',
    description: '最小化延迟，适合实时互动场景',
    config: {
      autoplay: true,
      muted: true,
      bufferSize: 0.5
    },
    rtcConfig: {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      iceCandidatePoolSize: 10
    },
    performance: {
      priority: 'latency',
      bufferSize: 0.5,
      maxRetries: 5
    }
  },
  
  // 高质量模式 - 适合观看体验
  highQuality: {
    name: '高质量模式',
    description: '优先画质，适合观看体验',
    config: {
      autoplay: true,
      muted: false,
      bufferSize: 5
    },
    rtcConfig: {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    },
    performance: {
      priority: 'quality',
      bufferSize: 5,
      maxRetries: 3
    }
  },
  
  // 省流量模式 - 适合移动网络
  lowBandwidth: {
    name: '省流量模式',
    description: '降低码率，节省流量',
    config: {
      autoplay: false,
      muted: true,
      bufferSize: 2
    },
    performance: {
      priority: 'bandwidth',
      bufferSize: 2,
      maxRetries: 2
    }
  },
  
  // 多流模式 - 适合监控场景
  multiStream: {
    name: '多流模式',
    description: '同时播放多个视频流',
    config: {
      autoplay: true,
      muted: true,
      bufferSize: 1
    },
    performance: {
      priority: 'bandwidth',
      bufferSize: 1,
      maxRetries: 2
    }
  }
}

// 配置管理类
export class PlayerConfigManager {
  private static instance: PlayerConfigManager
  private globalConfig: GlobalPlayerConfig
  private activePreset: string | null = null
  
  private constructor() {
    this.globalConfig = { ...DEFAULT_GLOBAL_CONFIG }
    this.loadFromStorage()
  }
  
  static getInstance(): PlayerConfigManager {
    if (!PlayerConfigManager.instance) {
      PlayerConfigManager.instance = new PlayerConfigManager()
    }
    return PlayerConfigManager.instance
  }
  
  // 获取全局配置
  getGlobalConfig(): GlobalPlayerConfig {
    return { ...this.globalConfig }
  }
  
  // 更新全局配置
  updateGlobalConfig(updates: Partial<GlobalPlayerConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...updates }
    this.saveToStorage()
  }
  
  // 应用预设配置
  applyPreset(presetName: string): PlayerConfig {
    const preset = PLAYER_PRESETS[presetName]
    if (!preset) {
      throw new Error(`未找到预设配置: ${presetName}`)
    }
    
    this.activePreset = presetName
    
    // 合并全局配置和预设配置
    const config: PlayerConfig = {
      width: this.globalConfig.defaultWidth,
      height: this.globalConfig.defaultHeight,
      autoplay: this.globalConfig.autoplay,
      muted: this.globalConfig.muted,
      showControls: this.globalConfig.showControls,
      bufferSize: this.globalConfig.bufferSize,
      ...preset.config,
      type: StreamType.AUTO, // 默认自动检测
      url: '', // 需要外部设置
      streams: [] // 多流配置
    }
    
    return config
  }
  
  // 获取当前预设
  getActivePreset(): string | null {
    return this.activePreset
  }
  
  // 获取预设列表
  getPresets(): Record<string, PlayerPreset> {
    return { ...PLAYER_PRESETS }
  }
  
  // 创建多流配置
  createMultiStreamConfig(streams: Array<{
    id: string
    name: string
    url: string
    type?: StreamType
    poster?: string
  }>): MultiStreamConfig {
    const baseConfig = this.applyPreset('multiStream')
    
    return {
      ...baseConfig,
      streams: streams.map(stream => ({
        id: stream.id,
        name: stream.name,
        url: stream.url,
        type: stream.type || StreamType.AUTO,
        poster: stream.poster,
        autoplay: baseConfig.autoplay,
        muted: baseConfig.muted
      }))
    }
  }
  
  // 获取RTC配置
  getRTCConfig(presetName?: string): RTCConfiguration {
    const preset = presetName ? PLAYER_PRESETS[presetName] : null
    
    return preset?.rtcConfig || {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  }
  
  // 从本地存储加载配置
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('universal-player-config')
      if (stored) {
        const config = JSON.parse(stored)
        this.globalConfig = { ...DEFAULT_GLOBAL_CONFIG, ...config }
      }
    } catch (error) {
      console.warn('加载配置失败，使用默认配置:', error)
    }
  }
  
  // 保存配置到本地存储
  private saveToStorage(): void {
    try {
      localStorage.setItem('universal-player-config', JSON.stringify(this.globalConfig))
    } catch (error) {
      console.warn('保存配置失败:', error)
    }
  }
  
  // 重置为默认配置
  resetToDefault(): void {
    this.globalConfig = { ...DEFAULT_GLOBAL_CONFIG }
    this.activePreset = null
    this.saveToStorage()
  }
  
  // 导出配置
  exportConfig(): string {
    return JSON.stringify({
      globalConfig: this.globalConfig,
      activePreset: this.activePreset
    }, null, 2)
  }
  
  // 导入配置
  importConfig(configJson: string): void {
    try {
      const config = JSON.parse(configJson)
      if (config.globalConfig) {
        this.globalConfig = { ...DEFAULT_GLOBAL_CONFIG, ...config.globalConfig }
      }
      if (config.activePreset) {
        this.activePreset = config.activePreset
      }
      this.saveToStorage()
    } catch (error) {
      throw new Error('配置格式无效')
    }
  }
}

// 导出单例实例
export const playerConfigManager = PlayerConfigManager.getInstance()

// 便捷函数
export const getGlobalConfig = () => playerConfigManager.getGlobalConfig()
export const applyPreset = (presetName: string) => playerConfigManager.applyPreset(presetName)
export const createMultiStreamConfig = (streams: any[]) => playerConfigManager.createMultiStreamConfig(streams)