/**
 * 播放器监控和统计模块
 * 提供实时性能监控、播放统计和错误追踪功能
 * 
 * 作者：代码侠 - 让数据说话，性能一目了然 📊
 */

import { PlaybackStats } from '@/types'

// 监控事件类型
export interface MonitorEvent {
  type: 'play' | 'pause' | 'error' | 'buffer' | 'quality' | 'network'
  timestamp: number
  data: any
  streamId?: string
}

// 性能指标
export interface PerformanceMetrics {
  // 播放指标
  totalPlayTime: number
  bufferEvents: number
  errorCount: number
  reconnectCount: number
  
  // 网络指标
  averageBitrate: number
  packetLoss: number
  latency: number
  
  // 质量指标
  averageFPS: number
  droppedFrames: number
  resolution: { width: number; height: number }
  
  // 用户行为
  playCount: number
  pauseCount: number
  seekCount: number
  volumeChanges: number
}

// 错误统计
export interface ErrorStats {
  networkErrors: number
  decodeErrors: number
  sourceErrors: number
  unknownErrors: number
  lastError?: {
    type: string
    message: string
    timestamp: number
  }
}

// 播放器监控类
export class PlayerMonitor {
  private events: MonitorEvent[] = []
  private metrics: Map<string, PerformanceMetrics> = new Map()
  private errors: Map<string, ErrorStats> = new Map()
  private startTime: number = 0
  private isMonitoring: boolean = false
  
  // 性能观察器
  private performanceObserver?: PerformanceObserver
  private networkObserver?: any
  
  constructor(private maxEvents: number = 1000) {
    this.initPerformanceObserver()
  }
  
  // 开始监控
  startMonitoring(streamId: string = 'default'): void {
    this.isMonitoring = true
    this.startTime = Date.now()
    
    // 初始化指标
    if (!this.metrics.has(streamId)) {
      this.metrics.set(streamId, this.createEmptyMetrics())
    }
    
    if (!this.errors.has(streamId)) {
      this.errors.set(streamId, this.createEmptyErrorStats())
    }
    
    this.recordEvent('play', { action: 'start_monitoring' }, streamId)
  }
  
  // 停止监控
  stopMonitoring(streamId: string = 'default'): void {
    this.isMonitoring = false
    this.recordEvent('pause', { action: 'stop_monitoring' }, streamId)
  }
  
  // 记录事件
  recordEvent(type: MonitorEvent['type'], data: any, streamId?: string): void {
    const event: MonitorEvent = {
      type,
      timestamp: Date.now(),
      data,
      streamId
    }
    
    this.events.push(event)
    
    // 限制事件数量
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }
    
    // 更新相关指标
    this.updateMetrics(event)
  }
  
  // 记录播放统计
  recordPlaybackStats(stats: PlaybackStats, streamId: string = 'default'): void {
    const metrics = this.metrics.get(streamId)
    if (!metrics) return
    
    // 更新播放指标
    if (stats.bitrate) {
      metrics.averageBitrate = this.calculateAverage(metrics.averageBitrate, stats.bitrate)
    }
    
    if (stats.fps) {
      metrics.averageFPS = this.calculateAverage(metrics.averageFPS, stats.fps)
    }
    
    if (stats.resolution) {
      metrics.resolution = stats.resolution
    }
    
    if (stats.droppedFrames !== undefined) {
      metrics.droppedFrames = stats.droppedFrames
    }
    
    this.recordEvent('quality', stats, streamId)
  }
  
  // 记录错误
  recordError(error: Error, type: 'network' | 'decode' | 'source' | 'unknown' = 'unknown', streamId: string = 'default'): void {
    const errorStats = this.errors.get(streamId)
    if (!errorStats) return
    
    // 更新错误计数
    switch (type) {
      case 'network':
        errorStats.networkErrors++
        break
      case 'decode':
        errorStats.decodeErrors++
        break
      case 'source':
        errorStats.sourceErrors++
        break
      default:
        errorStats.unknownErrors++
    }
    
    // 记录最后一个错误
    errorStats.lastError = {
      type,
      message: error.message,
      timestamp: Date.now()
    }
    
    this.recordEvent('error', {
      type,
      message: error.message,
      stack: error.stack
    }, streamId)
  }
  
  // 记录缓冲事件
  recordBufferEvent(duration: number, streamId: string = 'default'): void {
    const metrics = this.metrics.get(streamId)
    if (metrics) {
      metrics.bufferEvents++
    }
    
    this.recordEvent('buffer', { duration }, streamId)
  }
  
  // 记录网络状态
  recordNetworkStats(stats: {
    latency?: number
    packetLoss?: number
    bandwidth?: number
  }, streamId: string = 'default'): void {
    const metrics = this.metrics.get(streamId)
    if (!metrics) return
    
    if (stats.latency !== undefined) {
      metrics.latency = this.calculateAverage(metrics.latency, stats.latency)
    }
    
    if (stats.packetLoss !== undefined) {
      metrics.packetLoss = this.calculateAverage(metrics.packetLoss, stats.packetLoss)
    }
    
    this.recordEvent('network', stats, streamId)
  }
  
  // 获取性能指标
  getMetrics(streamId: string = 'default'): PerformanceMetrics | null {
    return this.metrics.get(streamId) || null
  }
  
  // 获取错误统计
  getErrorStats(streamId: string = 'default'): ErrorStats | null {
    return this.errors.get(streamId) || null
  }
  
  // 获取所有事件
  getEvents(type?: MonitorEvent['type'], streamId?: string): MonitorEvent[] {
    let filteredEvents = this.events
    
    if (type) {
      filteredEvents = filteredEvents.filter(event => event.type === type)
    }
    
    if (streamId) {
      filteredEvents = filteredEvents.filter(event => event.streamId === streamId)
    }
    
    return filteredEvents
  }
  
  // 获取监控报告
  getReport(streamId: string = 'default'): {
    metrics: PerformanceMetrics | null
    errors: ErrorStats | null
    events: MonitorEvent[]
    summary: {
      uptime: number
      errorRate: number
      averageQuality: string
      networkHealth: string
    }
  } {
    const metrics = this.getMetrics(streamId)
    const errors = this.getErrorStats(streamId)
    const events = this.getEvents(undefined, streamId)
    
    const uptime = this.startTime ? Date.now() - this.startTime : 0
    const totalEvents = events.length
    const errorEvents = events.filter(e => e.type === 'error').length
    const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0
    
    return {
      metrics,
      errors,
      events,
      summary: {
        uptime,
        errorRate,
        averageQuality: this.getQualityRating(metrics),
        networkHealth: this.getNetworkHealth(metrics)
      }
    }
  }
  
  // 清除数据
  clear(streamId?: string): void {
    if (streamId) {
      this.metrics.delete(streamId)
      this.errors.delete(streamId)
      this.events = this.events.filter(event => event.streamId !== streamId)
    } else {
      this.metrics.clear()
      this.errors.clear()
      this.events = []
    }
  }
  
  // 导出数据
  exportData(): string {
    return JSON.stringify({
      events: this.events,
      metrics: Object.fromEntries(this.metrics),
      errors: Object.fromEntries(this.errors),
      timestamp: Date.now()
    }, null, 2)
  }
  
  // 私有方法
  private createEmptyMetrics(): PerformanceMetrics {
    return {
      totalPlayTime: 0,
      bufferEvents: 0,
      errorCount: 0,
      reconnectCount: 0,
      averageBitrate: 0,
      packetLoss: 0,
      latency: 0,
      averageFPS: 0,
      droppedFrames: 0,
      resolution: { width: 0, height: 0 },
      playCount: 0,
      pauseCount: 0,
      seekCount: 0,
      volumeChanges: 0
    }
  }
  
  private createEmptyErrorStats(): ErrorStats {
    return {
      networkErrors: 0,
      decodeErrors: 0,
      sourceErrors: 0,
      unknownErrors: 0
    }
  }
  
  private updateMetrics(event: MonitorEvent): void {
    const streamId = event.streamId || 'default'
    const metrics = this.metrics.get(streamId)
    if (!metrics) return
    
    switch (event.type) {
      case 'play':
        metrics.playCount++
        break
      case 'pause':
        metrics.pauseCount++
        break
      case 'error':
        metrics.errorCount++
        break
      case 'buffer':
        metrics.bufferEvents++
        break
    }
  }
  
  private calculateAverage(current: number, newValue: number): number {
    return current === 0 ? newValue : (current + newValue) / 2
  }
  
  private getQualityRating(metrics: PerformanceMetrics | null): string {
    if (!metrics) return 'unknown'
    
    const score = Math.max(0, 100 - metrics.droppedFrames - metrics.bufferEvents * 5)
    
    if (score >= 90) return 'excellent'
    if (score >= 70) return 'good'
    if (score >= 50) return 'fair'
    return 'poor'
  }
  
  private getNetworkHealth(metrics: PerformanceMetrics | null): string {
    if (!metrics) return 'unknown'
    
    if (metrics.packetLoss < 1 && metrics.latency < 100) return 'excellent'
    if (metrics.packetLoss < 3 && metrics.latency < 200) return 'good'
    if (metrics.packetLoss < 5 && metrics.latency < 500) return 'fair'
    return 'poor'
  }
  
  private initPerformanceObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach(entry => {
          if (entry.entryType === 'measure') {
            this.recordEvent('quality', {
              name: entry.name,
              duration: entry.duration
            })
          }
        })
      })
      
      try {
        this.performanceObserver.observe({ entryTypes: ['measure'] })
      } catch (error) {
        console.warn('Performance Observer not supported:', error)
      }
    }
  }
}

// 全局监控实例
export const globalMonitor = new PlayerMonitor()

// 便捷函数
export const startMonitoring = (streamId?: string) => globalMonitor.startMonitoring(streamId)
export const stopMonitoring = (streamId?: string) => globalMonitor.stopMonitoring(streamId)
export const recordError = (error: Error, type?: any, streamId?: string) => globalMonitor.recordError(error, type, streamId)
export const getMonitorReport = (streamId?: string) => globalMonitor.getReport(streamId)