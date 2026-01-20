/**
 * 自动重连和错误恢复管理模块
 * 提供智能重连策略、错误恢复机制和连接状态管理
 * 
 * 作者：代码侠 - 网络断了不要慌，我来帮你自动重连 🔄
 */

// 重连策略类型
export type ReconnectStrategy = 'immediate' | 'exponential' | 'linear' | 'custom'

// 重连配置
export interface ReconnectConfig {
  strategy: ReconnectStrategy
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffFactor: number
  enableAutoReconnect: boolean
  retryOnErrors: string[]
  customDelayFunction?: (attempt: number) => number
}

// 连接状态
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

// 重连事件
export interface ReconnectEvent {
  type: 'attempt' | 'success' | 'failure' | 'abort'
  attempt: number
  delay: number
  error?: Error
  timestamp: number
}

// 重连管理器
export class ReconnectManager {
  private config: ReconnectConfig
  private state: ConnectionState = ConnectionState.DISCONNECTED
  private currentAttempt: number = 0
  private reconnectTimer?: number
  private isReconnecting: boolean = false
  private lastError?: Error
  private listeners: Map<string, Function[]> = new Map()
  
  // 默认配置
  private static readonly DEFAULT_CONFIG: ReconnectConfig = {
    strategy: 'exponential',
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    enableAutoReconnect: true,
    retryOnErrors: [
      'NetworkError',
      'TimeoutError',
      'ConnectionError',
      'MediaError'
    ]
  }
  
  constructor(config?: Partial<ReconnectConfig>) {
    this.config = { ...ReconnectManager.DEFAULT_CONFIG, ...config }
  }
  
  // 更新配置
  updateConfig(config: Partial<ReconnectConfig>): void {
    this.config = { ...this.config, ...config }
  }
  
  // 获取当前状态
  getState(): ConnectionState {
    return this.state
  }
  
  // 获取当前重连次数
  getCurrentAttempt(): number {
    return this.currentAttempt
  }
  
  // 开始连接
  async connect(connectFunction: () => Promise<void>): Promise<void> {
    this.setState(ConnectionState.CONNECTING)
    this.currentAttempt = 0
    
    try {
      await connectFunction()
      this.setState(ConnectionState.CONNECTED)
      this.emit('success', {
        type: 'success',
        attempt: this.currentAttempt,
        delay: 0,
        timestamp: Date.now()
      })
    } catch (error) {
      this.lastError = error as Error
      this.setState(ConnectionState.FAILED)
      
      if (this.config.enableAutoReconnect && this.shouldRetry(error as Error)) {
        this.startReconnect(connectFunction)
      } else {
        this.emit('failure', {
          type: 'failure',
          attempt: this.currentAttempt,
          delay: 0,
          error: error as Error,
          timestamp: Date.now()
        })
      }
    }
  }
  
  // 开始重连
  private startReconnect(connectFunction: () => Promise<void>): void {
    if (this.isReconnecting || this.currentAttempt >= this.config.maxRetries) {
      this.setState(ConnectionState.FAILED)
      return
    }
    
    this.isReconnecting = true
    this.setState(ConnectionState.RECONNECTING)
    this.currentAttempt++
    
    const delay = this.calculateDelay()
    
    this.emit('attempt', {
      type: 'attempt',
      attempt: this.currentAttempt,
      delay,
      timestamp: Date.now()
    })
    
    this.reconnectTimer = window.setTimeout(async () => {
      try {
        await connectFunction()
        this.setState(ConnectionState.CONNECTED)
        this.isReconnecting = false
        this.currentAttempt = 0
        
        this.emit('success', {
          type: 'success',
          attempt: this.currentAttempt,
          delay,
          timestamp: Date.now()
        })
      } catch (error) {
        this.lastError = error as Error
        this.isReconnecting = false
        
        if (this.currentAttempt < this.config.maxRetries && this.shouldRetry(error as Error)) {
          this.startReconnect(connectFunction)
        } else {
          this.setState(ConnectionState.FAILED)
          this.emit('failure', {
            type: 'failure',
            attempt: this.currentAttempt,
            delay,
            error: error as Error,
            timestamp: Date.now()
          })
        }
      }
    }, delay)
  }
  
  // 停止重连
  stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    
    this.isReconnecting = false
    this.setState(ConnectionState.DISCONNECTED)
    
    this.emit('abort', {
      type: 'abort',
      attempt: this.currentAttempt,
      delay: 0,
      timestamp: Date.now()
    })
  }
  
  // 手动重试
  async retry(connectFunction: () => Promise<void>): Promise<void> {
    this.stopReconnect()
    this.currentAttempt = 0
    await this.connect(connectFunction)
  }
  
  // 重置状态
  reset(): void {
    this.stopReconnect()
    this.currentAttempt = 0
    this.lastError = undefined
    this.setState(ConnectionState.DISCONNECTED)
  }
  
  // 计算延迟时间
  private calculateDelay(): number {
    const { strategy, initialDelay, maxDelay, backoffFactor, customDelayFunction } = this.config
    
    if (customDelayFunction) {
      return Math.min(customDelayFunction(this.currentAttempt), maxDelay)
    }
    
    let delay: number
    
    switch (strategy) {
      case 'immediate':
        delay = 0
        break
        
      case 'linear':
        delay = initialDelay * this.currentAttempt
        break
        
      case 'exponential':
        delay = initialDelay * Math.pow(backoffFactor, this.currentAttempt - 1)
        break
        
      default:
        delay = initialDelay
    }
    
    // 添加随机抖动，避免雷群效应
    const jitter = delay * 0.1 * Math.random()
    delay += jitter
    
    return Math.min(delay, maxDelay)
  }
  
  // 判断是否应该重试
  private shouldRetry(error: Error): boolean {
    if (!this.config.enableAutoReconnect) {
      return false
    }
    
    if (this.currentAttempt >= this.config.maxRetries) {
      return false
    }
    
    // 检查错误类型是否在重试列表中
    const errorName = error.constructor.name
    const errorMessage = error.message.toLowerCase()
    
    return this.config.retryOnErrors.some(retryError => 
      errorName.includes(retryError) || errorMessage.includes(retryError.toLowerCase())
    )
  }
  
  // 设置状态
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState
      this.emit('stateChange', newState)
    }
  }
  
  // 事件监听
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }
  
  // 移除事件监听
  off(event: string, callback?: Function): void {
    if (!this.listeners.has(event)) return
    
    if (callback) {
      const callbacks = this.listeners.get(event)!
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    } else {
      this.listeners.delete(event)
    }
  }
  
  // 触发事件
  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error('重连事件回调错误:', error)
        }
      })
    }
  }
  
  // 获取重连统计
  getStats(): {
    currentAttempt: number
    maxRetries: number
    state: ConnectionState
    lastError?: Error
    isReconnecting: boolean
  } {
    return {
      currentAttempt: this.currentAttempt,
      maxRetries: this.config.maxRetries,
      state: this.state,
      lastError: this.lastError,
      isReconnecting: this.isReconnecting
    }
  }
  
  // 销毁
  destroy(): void {
    this.stopReconnect()
    this.listeners.clear()
  }
}

// 创建预设重连管理器
export const createReconnectManager = (config?: Partial<ReconnectConfig>): ReconnectManager => {
  return new ReconnectManager(config)
}

// 预设配置
export const RECONNECT_PRESETS = {
  // 快速重连 - 适合稳定网络
  fast: {
    strategy: 'exponential' as ReconnectStrategy,
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 5000,
    backoffFactor: 1.5
  },
  
  // 标准重连 - 平衡性能和稳定性
  standard: {
    strategy: 'exponential' as ReconnectStrategy,
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 15000,
    backoffFactor: 2
  },
  
  // 持久重连 - 适合不稳定网络
  persistent: {
    strategy: 'exponential' as ReconnectStrategy,
    maxRetries: 10,
    initialDelay: 2000,
    maxDelay: 60000,
    backoffFactor: 1.8
  },
  
  // 线性重连 - 固定间隔
  linear: {
    strategy: 'linear' as ReconnectStrategy,
    maxRetries: 5,
    initialDelay: 3000,
    maxDelay: 15000,
    backoffFactor: 1
  }
}

// 便捷函数
export const createFastReconnect = () => createReconnectManager(RECONNECT_PRESETS.fast)
export const createStandardReconnect = () => createReconnectManager(RECONNECT_PRESETS.standard)
export const createPersistentReconnect = () => createReconnectManager(RECONNECT_PRESETS.persistent)