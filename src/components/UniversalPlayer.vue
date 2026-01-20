<template>
  <div class="universal-player" :style="playerStyle">
    <div class="player-container" ref="playerContainer">
      <!-- 视频播放区域 -->
      <video
        ref="videoElement"
        :width="globalConfig.defaultWidth"
        :height="globalConfig.defaultHeight"
        :poster="availableStreams.find(s => s.id === currentStreamId)?.poster"
        :muted="globalConfig.muted"
        :autoplay="globalConfig.autoplay"
        :controls="false"
        playsinline
        webkit-playsinline
        preload="none"
        @loadstart="handleLoadStart"
        @loadeddata="handleLoadedData"
        @play="handlePlay"
        @pause="handlePause"
        @error="handleError"
        @timeupdate="handleTimeUpdate"
        @volumechange="handleVolumeChange"
      ></video>
      
      <!-- 加载状态 -->
      <div v-if="status === PlayerStatus.LOADING" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">正在加载视频...</div>
      </div>
      
      <!-- 错误状态 -->
      <div v-if="status === PlayerStatus.ERROR" class="error-overlay">
        <div class="error-icon">⚠️</div>
        <div class="error-message">{{ errorMessage }}</div>
        <button @click="retry" class="retry-button">重试</button>
      </div>
      
      <!-- Custom Overlay Slot -->
      <div class="custom-overlay">
        <slot name="overlay" :status="status" :current-time="currentTime"></slot>
      </div>

      <!-- 控制栏 -->
      <div v-if="showControls" class="controls-bar" :class="{ 'controls-visible': controlsVisible }">
        <div class="controls-left">
          <slot name="controls-left"></slot>
          <button v-if="finalControlsConfig.showPlay" @click="togglePlay" class="control-button">
            {{ status === PlayerStatus.PLAYING ? '⏸️' : '▶️' }}
          </button>
          <button v-if="finalControlsConfig.showPlay" @click="stop" class="control-button">⏹️</button>
          <button v-if="finalControlsConfig.showPlay" @click="refresh" class="control-button">🔄</button>
          <span class="time-display">{{ formatTime(currentTime) }}</span>
        </div>
        
        <div class="controls-center">
          <div v-if="finalControlsConfig.showVolume" class="volume-control">
            <button @click="toggleMute" class="control-button">
              {{ isMuted ? '🔇' : '🔊' }}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              v-model="volume"
              @input="setVolume"
              class="volume-slider"
            />
          </div>
        </div>
        
        <div class="controls-right">
          <!-- 视频流切换控件 -->
          <div v-if="isMultiStreamMode && availableStreams.length > 1 && finalControlsConfig.showStreamSelector" class="stream-selector">
            <select 
              v-model="currentStreamId" 
              @change="handleStreamChange"
              class="stream-select"
              title="切换视频流"
            >
              <option 
                v-for="stream in availableStreams" 
                :key="stream.id" 
                :value="stream.id"
              >
                {{ stream.name }}
              </option>
            </select>
          </div>
          <button v-if="finalControlsConfig.showScreenshot" @click="screenshot" class="control-button" title="截图">📷</button>
          <button v-if="finalControlsConfig.showFrameExtract" @click="toggleFrameExtract" class="control-button" title="抽帧">
            {{ isExtracting ? '⏹️' : '🎞️' }}
          </button>
          <button v-if="finalControlsConfig.showFullscreen" @click="toggleFullscreen" class="control-button">⛶</button>
          <slot name="controls-right"></slot>
        </div>
      </div>
    </div>
    
    <!-- 统计信息 -->
    <div v-if="showStats" class="stats-panel">
      <div class="stats-item">状态: {{ status }}</div>
      <div class="stats-item">类型: {{ availableStreams.find(s => s.id === currentStreamId)?.type }}</div>
      <div class="stats-item" v-if="stats.bitrate">码率: {{ stats.bitrate }}kbps</div>
      <div class="stats-item" v-if="stats.fps">帧率: {{ stats.fps }}fps</div>
      <div class="stats-item" v-if="stats.resolution">
        分辨率: {{ stats.resolution.width }}x{{ stats.resolution.height }}
      </div>
      <div class="stats-item" v-if="monitoringEnabled">连接状态: {{ connectionState }}</div>
      <div class="stats-item" v-if="monitoringEnabled && globalMonitor.getReport(currentStreamId).errorCount > 0">
        错误次数: {{ globalMonitor.getReport(currentStreamId).errorCount }}
      </div>
    </div>
    
    <!-- 视频流轮播组件 -->
    <div 
      v-if="isMultiStreamMode && availableStreams.length > 1" 
      class="stream-carousel"
      :class="{ 'carousel-visible': controlsVisible }"
    >
      <div class="carousel-container">
        <button 
          class="carousel-nav carousel-prev" 
          @click="scrollCarousel('left')"
          :disabled="carouselScrollLeft <= 0"
        >
          ‹
        </button>
        
        <div class="carousel-wrapper" ref="carouselWrapper">
          <div 
            class="carousel-track" 
            ref="carouselTrack"
            :style="{ transform: `translateX(-${carouselScrollLeft}px)` }"
          >
            <div
              v-for="stream in availableStreams"
              :key="stream.id"
              class="stream-thumbnail"
              :class="{ 
                'active': stream.id === currentStreamId,
                'loading': streamLoadingStates[stream.id]
              }"
              @click="switchToStream(stream.id)"
            >
              <div class="thumbnail-container">
                <video
                  v-if="stream.id === currentStreamId"
                  :ref="el => setThumbnailRef(stream.id, el)"
                  class="thumbnail-video"
                  :poster="stream.poster"
                  muted
                  playsinline
                  webkit-playsinline
                ></video>
                <div v-else class="thumbnail-placeholder">
                  <img v-if="stream.poster" :src="stream.poster" alt="视频封面" />
                  <div v-else class="default-thumbnail">📹</div>
                </div>
                
                <!-- 加载状态 -->
                <div v-if="streamLoadingStates[stream.id]" class="thumbnail-loading">
                  <div class="loading-spinner-small"></div>
                </div>
                
                <!-- 播放指示器 -->
                <div v-if="stream.id === currentStreamId && status === PlayerStatus.PLAYING" class="play-indicator">
                  ▶
                </div>
                
                <!-- 状态显示 -->
                <div class="thumbnail-status">
                  {{ getStreamStatus(stream.id) }}
                </div>
              </div>
              
              <div class="thumbnail-name">{{ stream.name }}</div>
            </div>
          </div>
        </div>
        
        <button 
          class="carousel-nav carousel-next" 
          @click="scrollCarousel('right')"
          :disabled="carouselScrollLeft >= maxScrollLeft"
        >
          ›
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { 
  PlayerConfig, 
  PlayerEvents, 
  PlayerStatus, 
  StreamType, 
  ScreenshotConfig, 
  FrameExtractConfig,
  PlaybackStats,
  IPlayer,
  StreamConfig,
  MultiStreamConfig,
  ControlsConfig
} from '@/types'
import { 
  formatTime, 
  captureVideoFrame, 
  canvasToBlob, 
  downloadFile, 
  loadScript,
  detectStreamType,
  debounce
} from '@/utils'

// 新增导入
import { playerConfigManager, getGlobalConfig, createMultiStreamConfig } from '@/config/playerConfig'
import { globalMonitor, startMonitoring, stopMonitoring, recordError } from '@/utils/playerMonitor'
import { createStandardReconnect, ConnectionState } from '@/utils/reconnectManager'

interface Props {
  // 简化props，统一使用多流配置
  streams?: Array<{
    id: string
    name: string
    url: string
    type?: StreamType
    poster?: string
  }>
  preset?: string // 预设配置名称
  events?: PlayerEvents
  showControls?: boolean
  showStats?: boolean
  enableMonitoring?: boolean
  enableAutoReconnect?: boolean
  controlsConfig?: ControlsConfig
}

const props = withDefaults(defineProps<Props>(), {
  preset: 'multiStream',
  showControls: true,
  showStats: false,
  enableMonitoring: true,
  enableAutoReconnect: true,
  controlsConfig: () => ({})
})

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'stop'): void
  (e: 'error', error: Error): void
  (e: 'loadStart'): void
  (e: 'loadEnd'): void
  (e: 'timeUpdate', time: number): void
  (e: 'volumeChange', volume: number): void
  (e: 'streamSwitch', streamId: string, stream?: StreamConfig): void
}>()

const finalControlsConfig = computed(() => ({
  showPlay: true,
  showVolume: true,
  showFullscreen: true,
  showScreenshot: true,
  showStreamSelector: true,
  showFrameExtract: true,
  ...props.controlsConfig
}))

// 响应式数据
const playerContainer = ref<HTMLElement>()
const videoElement = ref<HTMLVideoElement>()
const status = ref<PlayerStatus>(PlayerStatus.IDLE)
const errorMessage = ref('')
const currentTime = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const controlsVisible = ref(true)
const isExtracting = ref(false)
const stats = reactive<PlaybackStats>({})

// 多视频流相关
const availableStreams = ref<StreamConfig[]>([])
const currentStreamId = ref<string | null>(null)
const isMultiStreamMode = ref(true) // 统一使用多流模式
const streamLoadingStates = reactive<Record<string, boolean>>({})

// 轮播相关
const carouselWrapper = ref<HTMLElement>()
const carouselTrack = ref<HTMLElement>()
const carouselScrollLeft = ref(0)
const maxScrollLeft = ref(0)
const thumbnailRefs = reactive<Record<string, HTMLVideoElement>>({})

// 新增：配置和监控相关
const globalConfig = ref(getGlobalConfig())
const playerConfig = ref<PlayerConfig>()
const reconnectManager = createStandardReconnect()
const connectionState = ref<ConnectionState>(ConnectionState.DISCONNECTED)
const monitoringEnabled = ref(props.enableMonitoring)

// 轮播配置
const THUMBNAIL_WIDTH = 160
const THUMBNAIL_GAP = 12
const SCROLL_STEP = THUMBNAIL_WIDTH + THUMBNAIL_GAP

// WebRTC 相关
let webrtcPlayer: any = null
let jswebrtcPlayer: any = null
let zlmRtcPlayer: any = null
let frameExtractTimer: number | null = null

// 多视频流播放器实例映射
const streamPlayers = new Map<string, any>()

// 计算属性
const playerStyle = computed(() => ({
  width: `${globalConfig.value.defaultWidth}px`,
  height: `${globalConfig.value.defaultHeight}px`
}))

// 监听重连状态
reconnectManager.on('stateChange', (newState: ConnectionState) => {
  connectionState.value = newState
})

reconnectManager.on('attempt', (event: any) => {
  console.log(`重连尝试 ${event.attempt}/${globalConfig.value.maxRetries}`)
  if (monitoringEnabled.value) {
    globalMonitor.recordEvent('network', { 
      action: 'reconnect_attempt', 
      attempt: event.attempt 
    }, currentStreamId.value || undefined)
  }
})

// 初始化配置
const initializeConfig = () => {
  try {
    // 应用预设配置
    playerConfig.value = playerConfigManager.applyPreset(props.preset || 'multiStream')
    
    // 如果有streams prop，创建多流配置
    if (props.streams && props.streams.length > 0) {
      const multiConfig = createMultiStreamConfig(props.streams)
      availableStreams.value = multiConfig.streams
      
      // 设置第一个流为当前流
      if (availableStreams.value.length > 0) {
        currentStreamId.value = availableStreams.value[0].id
      }
    }
    
    // 更新全局配置
    globalConfig.value = getGlobalConfig()
    
  } catch (error) {
    console.error('配置初始化失败:', error)
    recordError(error as Error, 'unknown', currentStreamId.value || undefined)
  }
}

const getCurrentStream = () => {
  if (!currentStreamId.value) return null
  return availableStreams.value.find(s => s.id === currentStreamId.value) || null
}

const getCurrentStreamType = () => {
  const s = getCurrentStream()
  return s?.type
}

const getCurrentStreamPlayConfig = (): PlayerConfig => {
  const s = getCurrentStream()
  return {
    ...playerConfig.value!,
    url: s?.url || '',
    type: s?.type
  }
}
// 播放器实例
const playerInstance: IPlayer = {
  async play() {
    await play()
  },
  pause() {
    pause()
  },
  stop() {
    stop()
  },
  refresh() {
    refresh()
  },
  setVolume(vol: number) {
    setVolume(vol)
  },
  getVolume() {
    return volume.value
  },
  getCurrentTime() {
    return currentTime.value
  },
  getDuration() {
    return videoElement.value?.duration || 0
  },
  getStatus() {
    return status.value
  },
  async screenshot(config?: ScreenshotConfig) {
    return await screenshot(config)
  },
  startFrameExtract(config?: FrameExtractConfig) {
    startFrameExtract(config)
  },
  stopFrameExtract() {
    stopFrameExtract()
  },
  destroy() {
    destroy()
  },
  // 多视频流管理方法
  async switchStream(streamId: string) {
    await switchToStream(streamId)
  },
  getCurrentStreamId() {
    return currentStreamId.value
  },
  getAvailableStreams() {
    return availableStreams.value
  },
  addStream(stream: StreamConfig) {
    addStream(stream)
  },
  removeStream(streamId: string) {
    removeStream(streamId)
  },
  
  // 新增方法
  getMonitorReport() {
    return globalMonitor.getReport(currentStreamId.value || undefined)
  },
  
  getConnectionState() {
    return connectionState.value
  },
  
  updatePreset(presetName: string) {
    try {
      playerConfig.value = playerConfigManager.applyPreset(presetName)
      refresh() // 重新加载以应用新配置
    } catch (error) {
      console.error('更新预设失败:', error)
    }
  },
  
  exportConfig() {
    return playerConfigManager.exportConfig()
  }
}

// 多流管理函数 - 需要在defineExpose之前定义
const switchToStream = async (streamId: string) => {
  const targetStream = availableStreams.value.find(stream => stream.id === streamId)
  if (!targetStream) {
    throw new Error(`未找到ID为 ${streamId} 的视频流`)
  }

  // 如果已经是当前流，直接返回
  if (currentStreamId.value === streamId) {
    return
  }

  // 设置轮播加载状态
  streamLoadingStates[streamId] = true

  // 保存当前播放器实例
  if (currentStreamId.value) {
    const currentPlayer = getCurrentPlayerInstance()
    if (currentPlayer) {
      streamPlayers.set(currentStreamId.value, currentPlayer)
    }
  }

  // 停止当前播放但不销毁实例
  stopCurrentStream()
  
  // 更新当前流ID
  const previousStreamId = currentStreamId.value
  currentStreamId.value = streamId
  
  try {
    status.value = PlayerStatus.LOADING
    console.log(`多流切换: 开始切换到流 ${streamId}, 类型: ${targetStream.type}`)
    
    // 检查是否已有该流的播放器实例
    const existingPlayer = streamPlayers.get(streamId)
    if (existingPlayer) {
      console.log(`多流切换: 复用已有播放器实例 ${streamId}`)
      // 复用已有实例
      Object.assign(playerInstance, existingPlayer)
      status.value = PlayerStatus.PLAYING
      streamLoadingStates[streamId] = false
      
      // 记录监控事件
      globalMonitor.recordEvent({
        type: 'stream_switch',
        streamId,
        timestamp: Date.now(),
        data: { from: previousStreamId, to: streamId, reused: true }
      })
      
      props.events?.onStreamSwitch?.(streamId, targetStream)
      return
    }

    // 创建新的播放器配置
    const streamConfig = {
      ...targetStream,
      ...globalConfig.value,
      events: {
        ...props.events,
        onPlay: () => {
          status.value = PlayerStatus.PLAYING
          streamLoadingStates[streamId] = false
          console.log(`多流播放: 流 ${streamId} 开始播放`)
          
          // 记录监控事件
          globalMonitor.recordEvent({
            type: 'stream_switch',
            streamId,
            timestamp: Date.now(),
            data: { from: previousStreamId, to: streamId, reused: false }
          })
          
          props.events?.onPlay?.()
          props.events?.onStreamSwitch?.(streamId, targetStream)
        },
        onError: async (error: any) => {
          status.value = PlayerStatus.ERROR
          streamLoadingStates[streamId] = false
          console.error(`多流播放错误: 流 ${streamId}`, error)
          
          // 记录错误
          globalMonitor.recordError(error, streamId)
          
          // 尝试重连
          if (globalConfig.value.autoReconnect) {
             reconnectManager.connect(async () => {
              await playStreamByConfig(streamConfig)
            })
          }
          
          props.events?.onError?.(error)
        }
      }
    }

    // 开始播放新流
    await playStreamByConfig(streamConfig)
    
  } catch (error) {
    console.error(`多流切换失败: ${streamId}`, error)
    status.value = PlayerStatus.ERROR
    streamLoadingStates[streamId] = false
    
    // 记录错误
    globalMonitor.recordError(error, streamId)
    
    // 回滚到之前的流
    if (previousStreamId) {
      currentStreamId.value = previousStreamId
    }
    
    throw error
  }
}

const addStream = (stream: StreamConfig) => {
  // 检查是否已存在相同ID的流
  const existingIndex = availableStreams.value.findIndex(s => s.id === stream.id)
  if (existingIndex !== -1) {
    // 更新现有流
    availableStreams.value[existingIndex] = stream
    console.log(`多流管理: 更新流 ${stream.id}`)
  } else {
    // 添加新流
    availableStreams.value.push(stream)
    console.log(`多流管理: 添加新流 ${stream.id}`)
  }
  
  // 记录监控事件
  globalMonitor.recordEvent({
    type: 'stream_added',
    streamId: stream.id,
    timestamp: Date.now(),
    data: stream
  })
}

const removeStream = (streamId: string) => {
  const index = availableStreams.value.findIndex(s => s.id === streamId)
  if (index === -1) {
    console.warn(`多流管理: 未找到要删除的流 ${streamId}`)
    return
  }

  // 如果要删除的是当前播放的流
  if (currentStreamId.value === streamId) {
    // 停止播放
    stopCurrentStream()
    
    // 如果还有其他流，切换到第一个
    const remainingStreams = availableStreams.value.filter(s => s.id !== streamId)
    if (remainingStreams.length > 0) {
      switchToStream(remainingStreams[0].id).catch(console.error)
    } else {
      currentStreamId.value = null
    }
  }

  // 清理播放器实例
  streamPlayers.delete(streamId)
  delete streamLoadingStates[streamId]
  
  // 从列表中移除
  availableStreams.value.splice(index, 1)
  console.log(`多流管理: 删除流 ${streamId}`)
  
  // 记录监控事件
  globalMonitor.recordEvent({
    type: 'stream_removed',
    streamId,
    timestamp: Date.now(),
    data: { remainingCount: availableStreams.value.length }
  })
}

// 暴露给父组件的方法
defineExpose({
  ...playerInstance,
  // 多流管理方法
  switchStream: switchToStream,
  addStream,
  removeStream,
  getAvailableStreams: () => availableStreams.value,
  getCurrentStreamId: () => currentStreamId.value,
  getConnectionState: () => connectionState.value,
  
  // 配置管理方法
  updateGlobalConfig: (config: Partial<typeof globalConfig.value>) => {
    Object.assign(globalConfig.value, config)
    playerConfigManager.updateGlobalConfig(config)
  },
  
  // 监控方法
  getMonitoringData: () => globalMonitor.getReport(currentStreamId.value || undefined),
  exportMonitoringData: () => globalMonitor.exportData(),
  
  // 重连管理
  forceReconnect: async () => await reconnectManager.connect(async () => {
    await playStreamByConfig(getCurrentStreamPlayConfig())
  }),
  stopReconnect: () => reconnectManager.stopReconnect()
})

// 事件处理
const handleLoadStart = () => {
  status.value = PlayerStatus.LOADING
  props.events?.onLoadStart?.()
  emit('loadStart')
}

const handleLoadedData = () => {
  if (getCurrentStreamType() !== StreamType.WEBRTC && getCurrentStreamType() !== StreamType.ZLM_RTC) {
    status.value = PlayerStatus.IDLE
  }
  props.events?.onLoadEnd?.()
  emit('loadEnd')
}

const handlePlay = () => {
  if (getCurrentStreamType() !== StreamType.WEBRTC && getCurrentStreamType() !== StreamType.ZLM_RTC) {
    status.value = PlayerStatus.PLAYING
    props.events?.onPlay?.()
    emit('play')
  } else if (status.value !== PlayerStatus.PLAYING) {
    props.events?.onPlay?.()
    emit('play')
  }
}

const handlePause = () => {
  status.value = PlayerStatus.PAUSED
  props.events?.onPause?.()
  emit('pause')
}

const handleError = async (event: Event) => {
  status.value = PlayerStatus.ERROR
  connectionState.value = ConnectionState.FAILED
  const error = new Error('视频播放错误')
  errorMessage.value = error.message
  
  if (monitoringEnabled.value) {
    recordError(error, 'video_element', currentStreamId.value || undefined)
  }
  
  props.events?.onError?.(error)
  emit('error', error)
  
  if (props.enableAutoReconnect) {
    reconnectManager.connect(async () => {
      await playStreamByConfig(getCurrentStreamPlayConfig())
    })
  }
}

const handleTimeUpdate = () => {
  if (videoElement.value) {
    currentTime.value = videoElement.value.currentTime
    props.events?.onTimeUpdate?.(currentTime.value)
    emit('timeUpdate', currentTime.value)
  }
}

const handleVolumeChange = () => {
  if (videoElement.value) {
    const newVolume = videoElement.value.volume
    // 验证音量值是否有效
    if (isFinite(newVolume) && newVolume >= 0 && newVolume <= 1) {
      volume.value = newVolume
    } else {
      console.warn('Invalid volume from video element:', newVolume)
      volume.value = 1.0
    }
    isMuted.value = videoElement.value.muted
    props.events?.onVolumeChange?.(volume.value)
    emit('volumeChange', volume.value)
  }
}

// 播放控制方法
const play = async () => {
  try {
    status.value = PlayerStatus.LOADING
    
    // 初始化配置
    initializeConfig()
    
    // 启动监控
    if (monitoringEnabled.value) {
      startMonitoring()
    }
    
    if (currentStreamId.value) {
      const currentStream = availableStreams.value.find(s => s.id === currentStreamId.value)
      if (currentStream) {
        // 记录播放开始事件
        if (monitoringEnabled.value) {
          globalMonitor.recordEvent('playback', { 
            action: 'play_start',
            streamType: currentStream.type
          }, currentStreamId.value)
        }
        
        // 设置重连管理器
        if (props.enableAutoReconnect) {
          reconnectManager.updateConfig({
            maxRetries: globalConfig.value.maxRetries,
            initialDelay: globalConfig.value.retryDelay,
            backoffFactor: globalConfig.value.backoffMultiplier
          })
        }
        
        await playStreamByConfig({
          ...playerConfig.value!,
          url: currentStream.url,
          type: currentStream.type
        })
      } else {
        throw new Error('未找到可播放的视频流')
      }
    } else {
      throw new Error('没有可用的视频流')
    }
  } catch (error) {
    status.value = PlayerStatus.ERROR
    errorMessage.value = error instanceof Error ? error.message : '播放失败'
    
    // 记录错误
    if (monitoringEnabled.value) {
      recordError(error as Error, 'unknown', currentStreamId.value || undefined)
    }
    
    // 尝试自动重连
    if (props.enableAutoReconnect && connectionState.value !== ConnectionState.RECONNECTING) {
      await reconnectManager.connect(async () => {
        await playStreamByConfig(getCurrentStreamPlayConfig())
      })
    }
    
    const err = error instanceof Error ? error : new Error('播放失败')
    props.events?.onError?.(err)
    emit('error', err)
  }
}

const playWebRTC = async (config?: PlayerConfig) => {
  await loadScript('/vendors/adapter-7.4.0.min.js')
  await loadScript('/vendors/srs.sdk.js')
  
  // 检查全局变量是否存在
  if (!window.SrsRtcWhipWhepAsync) {
    throw new Error('SRS SDK 加载失败')
  }
  
  if (webrtcPlayer) {
    webrtcPlayer.close()
  }
  
  webrtcPlayer = new window.SrsRtcWhipWhepAsync()
  
  // 设置事件监听器来处理远程流
  webrtcPlayer.pc.ontrack = (event) => {
    console.log('收到远程流:', event.streams[0])
    if (videoElement.value && event.streams[0]) {
      videoElement.value.srcObject = event.streams[0]
      videoElement.value.play().catch(e => {
        console.warn('自动播放失败:', e)
      })
    }
  }
  
  // 监听连接状态变化
  webrtcPlayer.pc.onconnectionstatechange = async () => {
    console.log('WebRTC连接状态:', webrtcPlayer.pc.connectionState)
    const state = webrtcPlayer.pc.connectionState
    
    if (monitoringEnabled.value) {
      globalMonitor.recordEvent('network', { 
        action: 'connection_state_change', 
        state 
      }, currentStreamId.value || undefined)
    }
    
    if (state === 'connected') {
      status.value = PlayerStatus.PLAYING
      connectionState.value = ConnectionState.CONNECTED
      reconnectManager.reset()
    } else if (state === 'failed') {
      status.value = PlayerStatus.ERROR
      connectionState.value = ConnectionState.FAILED
      const err = new Error('WebRTC连接失败')
      props.events?.onError?.(err)
      emit('error', err)
      
      if (props.enableAutoReconnect) {
        await reconnectManager.connect(async () => {
          await playStreamByConfig(getCurrentStreamPlayConfig())
        })
      }
    }
  }
  
  try {
    const playUrl = config?.url || getCurrentPlayUrl()
    connectionState.value = ConnectionState.CONNECTING
    await webrtcPlayer.play(playUrl)
    console.log('WebRTC播放请求已发送')
  } catch (error) {
    console.error('WebRTC播放失败:', error)
    status.value = PlayerStatus.ERROR
    connectionState.value = ConnectionState.FAILED
    
    if (monitoringEnabled.value) {
      recordError(error as Error, 'webrtc', currentStreamId.value || undefined)
    }
    
    const err = error instanceof Error ? error : new Error('WebRTC播放失败')
    props.events?.onError?.(err)
    emit('error', err)
    throw error
  }
}

const playZLMRTC = async (config?: PlayerConfig) => {
  await loadScript('/vendors/ZLMRTCClient.js')
  
  // 检查全局变量是否存在
  if (!window.ZLMRTCClient) {
    throw new Error('ZLM RTC 客户端加载失败')
  }
  
  if (zlmRtcPlayer) {
    zlmRtcPlayer.close()
  }
  
  if (!videoElement.value) {
    throw new Error('视频元素未找到')
  }
  
  // 获取播放URL
  const playUrl = config?.url || getCurrentPlayUrl()
  
  // 创建 ZLM RTC 播放器实例
  zlmRtcPlayer = new window.ZLMRTCClient.Endpoint({
    element: videoElement.value,
    debug: false,
    zlmsdpUrl: playUrl,
    simulcast: false,
    useCamera: false, // 不使用摄像头
    audioEnable: false, // 接收模式下不启用音频发送
    videoEnable: false, // 接收模式下不启用视频发送  
    recvOnly: true, // 纯接收模式，不发送任何媒体流，避免媒体捕获
    resolution: { w: globalConfig.value.defaultWidth, h: globalConfig.value.defaultHeight },
    usedatachannel: false,
    videoId: '',
    audioId: '',
    // 优化配置以减少卡顿
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  })
  
  // 设置事件监听器
  zlmRtcPlayer.on(window.ZLMRTCClient.Events.WEBRTC_ICE_CANDIDATE_ERROR, (e: any) => {
    console.warn('ZLM RTC: ICE候选错误', e)
    // 不立即设置为ERROR状态，因为可能还有其他ICE候选可以成功
    // 只有在连接完全失败时才设置错误状态
  })
  
  zlmRtcPlayer.on(window.ZLMRTCClient.Events.WEBRTC_ON_REMOTE_STREAMS, (s: any) => {
    console.log('ZLM RTC: 收到远程流', s)
    console.log('ZLM RTC: 当前状态', status.value)
    console.log('ZLM RTC: 视频元素存在', !!videoElement.value)
    
    if (videoElement.value && s && s.length > 0) {
      const stream = s[0]
      console.log('ZLM RTC: 设置视频流', stream)
      videoElement.value.srcObject = stream
      
      console.log('ZLM RTC: 视频是否暂停', videoElement.value.paused)
      
      // 立即设置状态为PLAYING，清除错误状态
      console.log('ZLM RTC: 立即设置状态为PLAYING')
      status.value = PlayerStatus.PLAYING
      errorMessage.value = ''
      props.events?.onPlay?.()
      
      // 使用 setTimeout 确保在所有同步事件处理完成后再次设置状态
      setTimeout(() => {
        console.log('ZLM RTC: 延迟确认状态为PLAYING')
        status.value = PlayerStatus.PLAYING
        errorMessage.value = ''
      }, 100)
      
      // 尝试播放视频
      if (videoElement.value.paused) {
        console.log('ZLM RTC: 尝试播放视频')
        videoElement.value.play().then(() => {
          console.log('ZLM RTC: 视频播放成功')
          // 再次确保状态正确
          setTimeout(() => {
            console.log('ZLM RTC: 播放成功后确认状态')
            status.value = PlayerStatus.PLAYING
            errorMessage.value = ''
          }, 50)
        }).catch((e) => {
          console.warn('ZLM RTC: 视频播放失败', e)
          // 即使播放失败，也设置为播放状态，因为流已连接
          setTimeout(() => {
            console.log('ZLM RTC: 播放失败但保持PLAYING状态')
            status.value = PlayerStatus.PLAYING
            errorMessage.value = ''
          }, 50)
        })
      }
    } else {
      console.warn('ZLM RTC: 视频元素或流不存在')
    }
  })
  
  zlmRtcPlayer.on(window.ZLMRTCClient.Events.WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED, (e: any) => {
    console.warn('ZLM RTC: Offer/Answer交换失败', e)
    // 延迟设置错误状态，给连接更多时间
    setTimeout(() => {
      if (status.value === PlayerStatus.LOADING) {
        status.value = PlayerStatus.ERROR
        errorMessage.value = 'WebRTC 连接失败'
        props.events?.onError?.(new Error('WebRTC 连接失败'))
      }
    }, 2000)
  })
  
  zlmRtcPlayer.on(window.ZLMRTCClient.Events.CAPTURE_STREAM_FAILED, (e: any) => {
    console.warn('ZLM RTC: 获取流失败', e)
    // 延迟设置错误状态
    setTimeout(() => {
      if (status.value === PlayerStatus.LOADING) {
        status.value = PlayerStatus.ERROR
        errorMessage.value = '获取视频流失败'
        props.events?.onError?.(new Error('获取视频流失败'))
      }
    }, 2000)
  })
  
  zlmRtcPlayer.on(window.ZLMRTCClient.Events.WEBRTC_ON_CONNECTION_STATE_CHANGE, async (state: any) => {
    console.log('ZLM RTC: 连接状态变化', state)
    
    if (monitoringEnabled.value) {
      globalMonitor.recordEvent('network', { 
        action: 'connection_state_change', 
        state 
      }, currentStreamId.value || undefined)
    }
    
    if (state === 'connected') {
      console.log('ZLM RTC: 连接已建立')
      connectionState.value = ConnectionState.CONNECTED
      reconnectManager.reset()
      
      // 连接成功后，检查视频元素是否已有流
      setTimeout(() => {
        if (videoElement.value && videoElement.value.srcObject) {
          console.log('ZLM RTC: 检测到视频流，设置为播放状态')
          status.value = PlayerStatus.PLAYING
          errorMessage.value = ''
          props.events?.onPlay?.()
        }
      }, 100)
    } else if (state === 'failed' || state === 'disconnected') {
      console.log('ZLM RTC: 连接失败或断开', state)
      status.value = PlayerStatus.ERROR
      connectionState.value = ConnectionState.FAILED
      errorMessage.value = '连接断开'
      
      const error = new Error(`连接状态: ${state}`)
      if (monitoringEnabled.value) {
        recordError(error, 'zlm_rtc', currentStreamId.value || undefined)
      }
      
      props.events?.onError?.(error)
      
      if (props.enableAutoReconnect) {
        await reconnectManager.connect(async () => {
          await playStreamByConfig(getCurrentStreamPlayConfig())
        })
      }
    }
  })

  // 添加更多事件监听器
  zlmRtcPlayer.on(window.ZLMRTCClient.Events.WEBRTC_ON_LOCAL_STREAM, (stream: any) => {
    console.log('ZLM RTC: 本地流事件', stream)
  })

  zlmRtcPlayer.on(window.ZLMRTCClient.Events.WEBRTC_ON_DATA_CHANNEL_OPEN, () => {
    console.log('ZLM RTC: 数据通道打开')
  })

  zlmRtcPlayer.on(window.ZLMRTCClient.Events.WEBRTC_ON_DATA_CHANNEL_MSG, (msg: any) => {
    console.log('ZLM RTC: 数据通道消息', msg)
  })

  zlmRtcPlayer.on(window.ZLMRTCClient.Events.WEBRTC_ON_DATA_CHANNEL_ERR, (err: any) => {
    console.log('ZLM RTC: 数据通道错误', err)
  })

  zlmRtcPlayer.on(window.ZLMRTCClient.Events.WEBRTC_ON_DATA_CHANNEL_CLOSE, () => {
    console.log('ZLM RTC: 数据通道关闭')
  })
  
  console.log('ZLM RTC: 开始连接', playUrl)
  // 清除之前的错误状态
  errorMessage.value = ''
  status.value = PlayerStatus.LOADING
  connectionState.value = ConnectionState.CONNECTING
  
  try {
    await zlmRtcPlayer.start()
    console.log('ZLM RTC: 连接启动成功')
    
    // 在多流模式下，保存ZLM RTC实例到streamPlayers
    if (isMultiStreamMode.value && currentStreamId.value) {
      streamPlayers.set(currentStreamId.value, zlmRtcPlayer)
      console.log('ZLM RTC: 实例已保存到streamPlayers', currentStreamId.value)
    }
  } catch (error) {
    console.error('ZLM RTC: 连接启动失败', error)
    status.value = PlayerStatus.ERROR
    connectionState.value = ConnectionState.FAILED
    errorMessage.value = error instanceof Error ? error.message : 'ZLM RTC连接失败'
    
    if (monitoringEnabled.value) {
      recordError(error as Error, 'zlm_rtc', currentStreamId.value || undefined)
    }
    
    props.events?.onError?.(error instanceof Error ? error : new Error('ZLM RTC连接失败'))
    
    if (props.enableAutoReconnect) {
      await reconnectManager.connect(async () => {
        await playStreamByConfig(getCurrentStreamPlayConfig())
      })
    }
    
    throw error
  }
}

const playStreaming = async (config?: PlayerConfig) => {
  try {
    const playUrl = config?.url || getCurrentPlayUrl()
    if (!playUrl) {
      throw new Error('播放地址不能为空')
    }

    connectionState.value = ConnectionState.CONNECTING
    
    // 这里可以集成其他流媒体播放器，如 flv.js, hls.js 等
    if (videoElement.value) {
      videoElement.value.src = playUrl
      await videoElement.value.play()
      status.value = PlayerStatus.PLAYING
      connectionState.value = ConnectionState.CONNECTED
      
      if (monitoringEnabled.value) {
        globalMonitor.recordEvent('playback', { 
          action: 'streaming_play_success',
          url: playUrl
        }, currentStreamId.value || undefined)
      }
    }
  } catch (error) {
    console.error('流媒体播放失败:', error)
    status.value = PlayerStatus.ERROR
    connectionState.value = ConnectionState.FAILED
    
    if (monitoringEnabled.value) {
      recordError(error as Error, 'streaming', currentStreamId.value || undefined)
    }
    
    props.events?.onError?.(error instanceof Error ? error : new Error('流媒体播放失败'))
    
    if (props.enableAutoReconnect) {
      await reconnectManager.connect(async () => {
        await playStreamByConfig(getCurrentStreamPlayConfig())
      })
    }
    
    throw error
  }
}

const playNative = async (config?: PlayerConfig) => {
  try {
    const playUrl = config?.url || getCurrentPlayUrl()
    if (!playUrl) {
      throw new Error('播放地址不能为空')
    }

    connectionState.value = ConnectionState.CONNECTING
    
    if (videoElement.value) {
      videoElement.value.src = playUrl
      await videoElement.value.play()
      status.value = PlayerStatus.PLAYING
      connectionState.value = ConnectionState.CONNECTED
      
      if (monitoringEnabled.value) {
        globalMonitor.recordEvent('playback', { 
          action: 'native_play_success',
          url: playUrl
        }, currentStreamId.value || undefined)
      }
    }
  } catch (error) {
    console.error('原生播放失败:', error)
    status.value = PlayerStatus.ERROR
    connectionState.value = ConnectionState.FAILED
    
    if (monitoringEnabled.value) {
      recordError(error as Error, 'native', currentStreamId.value || undefined)
    }
    
    props.events?.onError?.(error instanceof Error ? error : new Error('原生播放失败'))
    
    if (props.enableAutoReconnect) {
      await reconnectManager.connect(async () => {
        await playStreamByConfig(getCurrentStreamPlayConfig())
      })
    }
    
    throw error
  }
}

const pause = () => {
  if (videoElement.value && !videoElement.value.paused) {
    videoElement.value.pause()
  }
  status.value = PlayerStatus.PAUSED
}

const stop = () => {
  if (webrtcPlayer) {
    webrtcPlayer.close()
    webrtcPlayer = null
  }
  
  if (jswebrtcPlayer) {
    jswebrtcPlayer.destroy()
    jswebrtcPlayer = null
  }
  
  if (zlmRtcPlayer) {
    zlmRtcPlayer.close()
    zlmRtcPlayer = null
  }
  
  if (videoElement.value) {
    videoElement.value.pause()
    videoElement.value.src = ''
    videoElement.value.srcObject = null
  }
  
  status.value = PlayerStatus.STOPPED
  props.events?.onStop?.()
}

const refresh = () => {
  stop()
  nextTick(() => {
    play()
  })
}

const togglePlay = () => {
  if (status.value === PlayerStatus.PLAYING) {
    pause()
  } else {
    play()
  }
}

const setVolume = (vol?: number) => {
  const newVolume = vol !== undefined ? vol : volume.value
  // 验证音量值是否有效
  if (!isFinite(newVolume) || newVolume < 0 || newVolume > 1) {
    console.warn('Invalid volume value:', newVolume, 'Setting to 1.0')
    volume.value = 1.0
    if (videoElement.value) {
      videoElement.value.volume = 1.0
    }
    return
  }
  
  if (videoElement.value) {
    videoElement.value.volume = newVolume
    volume.value = newVolume
  }
}

const toggleMute = () => {
  if (videoElement.value) {
    videoElement.value.muted = !videoElement.value.muted
    isMuted.value = videoElement.value.muted
  }
}

const toggleFullscreen = () => {
  if (playerContainer.value) {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      playerContainer.value.requestFullscreen()
    }
  }
}

const retry = () => {
  errorMessage.value = ''
  play()
}

// 截图功能
const screenshot = async (config?: ScreenshotConfig): Promise<string> => {
  if (!videoElement.value) {
    throw new Error('视频元素不存在')
  }
  
  const canvas = captureVideoFrame(videoElement.value)
  const format = config?.format || 'png'
  const quality = config?.quality || 0.92
  
  if (config?.width || config?.height) {
    const resizedCanvas = document.createElement('canvas')
    const ctx = resizedCanvas.getContext('2d')
    if (ctx) {
      resizedCanvas.width = config.width || canvas.width
      resizedCanvas.height = config.height || canvas.height
      ctx.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height)
      const blob = await canvasToBlob(resizedCanvas, `image/${format}`, quality)
      const filename = `screenshot_${Date.now()}.${format}`
      downloadFile(blob, filename)
      return URL.createObjectURL(blob)
    }
  }
  
  const blob = await canvasToBlob(canvas, `image/${format}`, quality)
  const filename = `screenshot_${Date.now()}.${format}`
  downloadFile(blob, filename)
  return URL.createObjectURL(blob)
}

// 抽帧功能
const startFrameExtract = (config?: FrameExtractConfig) => {
  if (isExtracting.value) return
  
  const interval = (config?.interval || 1) * 1000
  const format = config?.format || 'png'
  const quality = config?.quality || 0.92
  const maxFrames = config?.maxFrames || 100
  let frameCount = 0
  
  isExtracting.value = true
  
  frameExtractTimer = window.setInterval(async () => {
    if (!videoElement.value || frameCount >= maxFrames) {
      stopFrameExtract()
      return
    }
    
    try {
      const canvas = captureVideoFrame(videoElement.value)
      const blob = await canvasToBlob(canvas, `image/${format}`, quality)
      const filename = `frame_${frameCount + 1}_${Date.now()}.${format}`
      downloadFile(blob, filename)
      frameCount++
    } catch (error) {
      console.error('抽帧失败:', error)
    }
  }, interval)
}

const stopFrameExtract = () => {
  if (frameExtractTimer) {
    clearInterval(frameExtractTimer)
    frameExtractTimer = null
  }
  isExtracting.value = false
}

const toggleFrameExtract = () => {
  if (isExtracting.value) {
    stopFrameExtract()
  } else {
    startFrameExtract()
  }
}

// 处理视频流切换
const handleStreamChange = async () => {
  if (currentStreamId.value) {
    try {
      await switchToStream(currentStreamId.value)
    } catch (error) {
      console.error('切换视频流失败:', error)
    }
  }
}

// 轮播相关方法
const setThumbnailRef = (streamId: string, el: HTMLVideoElement | null) => {
  if (el) {
    thumbnailRefs[streamId] = el
  } else {
    delete thumbnailRefs[streamId]
  }
}

const scrollCarousel = (direction: 'left' | 'right') => {
  if (!carouselWrapper.value) return
  
  const currentScroll = carouselScrollLeft.value
  const step = direction === 'left' ? -SCROLL_STEP : SCROLL_STEP
  const newScroll = Math.max(0, Math.min(currentScroll + step, maxScrollLeft.value))
  
  carouselScrollLeft.value = newScroll
  carouselWrapper.value.scrollTo({
    left: newScroll,
    behavior: 'smooth'
  })
}

const updateCarouselScrollLimits = () => {
  if (carouselWrapper.value && carouselTrack.value) {
    const wrapperWidth = carouselWrapper.value.clientWidth
    const trackWidth = carouselTrack.value.scrollWidth
    maxScrollLeft.value = Math.max(0, trackWidth - wrapperWidth)
  }
}

// 更新轮播布局
const updateCarouselLayout = () => {
  nextTick(() => {
    if (carouselTrack.value) {
      const totalWidth = availableStreams.value.length * (THUMBNAIL_WIDTH + THUMBNAIL_GAP)
      const containerWidth = carouselWrapper.value?.clientWidth || 0
      maxScrollLeft.value = Math.max(0, totalWidth - containerWidth)
    }
  })
}

// 更新轮播位置
const updateCarouselPosition = () => {
  if (!currentStreamId.value || !carouselWrapper.value) return
  
  const currentIndex = availableStreams.value.findIndex(s => s.id === currentStreamId.value)
  if (currentIndex === -1) return
  
  const targetPosition = currentIndex * SCROLL_STEP
  const containerWidth = carouselWrapper.value.clientWidth
  const maxScroll = maxScrollLeft.value
  
  // 计算最佳滚动位置，确保当前项可见
  let scrollPosition = targetPosition - (containerWidth / 2) + (THUMBNAIL_WIDTH / 2)
  scrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll))
  
  carouselScrollLeft.value = scrollPosition
  carouselWrapper.value.scrollTo({
    left: scrollPosition,
    behavior: 'smooth'
  })
}

// 处理轮播滚动
const handleCarouselScroll = debounce(() => {
  if (carouselWrapper.value) {
    carouselScrollLeft.value = carouselWrapper.value.scrollLeft
  }
}, 16)



const getStreamStatus = (streamId: string) => {
  if (streamLoadingStates[streamId]) return '加载中...'
  if (streamId === currentStreamId.value) {
    switch (status.value) {
      case PlayerStatus.PLAYING: return '播放中'
      case PlayerStatus.PAUSED: return '已暂停'
      case PlayerStatus.LOADING: return '加载中'
      case PlayerStatus.ERROR: return '错误'
      default: return '就绪'
    }
  }
  return '待播放'
}

// 控制栏自动隐藏
const hideControlsTimer = ref<number>()
const resetHideTimer = debounce(() => {
  controlsVisible.value = true
  if (hideControlsTimer.value) {
    clearTimeout(hideControlsTimer.value)
  }
  hideControlsTimer.value = window.setTimeout(() => {
    controlsVisible.value = false
  }, 3000)
}, 100)

// 获取当前播放URL的辅助函数
const getCurrentPlayUrl = () => {
  if (currentStreamId.value) {
    const currentStream = availableStreams.value.find(s => s.id === currentStreamId.value)
    return currentStream?.url || ''
  }
  return ''
}

const playStreamByConfig = async (config: PlayerConfig) => {
  try {
    // 记录播放开始
    if (monitoringEnabled.value) {
      globalMonitor.recordEvent('playback', { 
        action: 'stream_start',
        streamType: config.type,
        url: config.url
      }, currentStreamId.value || undefined)
    }

    switch (config.type) {
      case StreamType.WEBRTC:
        await playWebRTC(config)
        break
      case StreamType.ZLM_RTC:
        await playZLMRTC(config)
        break
      case StreamType.RTMP:
      case StreamType.RTSP:
      case StreamType.GB28181:
        await playStreaming(config)
        break
      case StreamType.HLS:
      case StreamType.FLV:
        await playNative(config)
        break
      default:
        throw new Error(`不支持的视频流类型: ${config.type}`)
    }
  } catch (error) {
    console.error('播放流失败:', error)
    if (monitoringEnabled.value) {
      recordError(error as Error, config.type, currentStreamId.value || undefined)
    }
    throw error
  }
}

// 获取当前播放器实例
const getCurrentPlayerInstance = () => {
  if (webrtcPlayer) return webrtcPlayer
  if (jswebrtcPlayer) return jswebrtcPlayer
  if (zlmRtcPlayer) return zlmRtcPlayer
  return null
}

// 停止当前流但不销毁实例
const stopCurrentStream = () => {
  if (videoElement.value) {
    videoElement.value.pause()
    // 在多流模式下，对于ZLM RTC需要清除srcObject
    if (isMultiStreamMode.value && zlmRtcPlayer) {
      videoElement.value.srcObject = null
    }
  }
  status.value = PlayerStatus.STOPPED
}

// 恢复播放器实例
const resumePlayerInstance = async (player: any, stream: StreamConfig): Promise<boolean> => {
  try {
    if (!videoElement.value) return false
    
    // 根据流类型恢复播放
    switch (stream.type) {
      case StreamType.WEBRTC:
        if (player && typeof player.play === 'function') {
          webrtcPlayer = player
          videoElement.value.srcObject = player.stream
          await player.play(stream.url)
          return true
        }
        break
      case StreamType.ZLM_RTC:
        if (player && typeof player.on === 'function') {
          zlmRtcPlayer = player
          // ZLM RTC实例需要重新创建，因为WebRTC连接状态无法恢复
          // 直接返回false，让系统创建新实例
          console.log('ZLM RTC: 需要重新创建实例')
          return false
        }
        break
      case StreamType.RTMP:
      case StreamType.RTSP:
      case StreamType.GB28181:
        if (player && typeof player.play === 'function') {
          jswebrtcPlayer = player
          await player.play()
          return true
        }
        break
      case StreamType.HLS:
      case StreamType.FLV:
        videoElement.value.src = stream.url
        await videoElement.value.play()
        return true
    }
    return false
  } catch (error) {
    console.warn('恢复播放器实例失败:', error)
    return false
  }
}

// 创建新的播放器实例
const createNewPlayerInstance = async (stream: StreamConfig) => {
  // 对于ZLM RTC，确保清理旧实例
  if (stream.type === StreamType.ZLM_RTC && zlmRtcPlayer) {
    console.log('ZLM RTC: 清理旧实例')
    try {
      zlmRtcPlayer.close()
    } catch (error) {
      console.warn('ZLM RTC: 清理旧实例失败', error)
    }
    zlmRtcPlayer = null
  }
  
  const config = {
    ...props.config,
    url: stream.url,
    type: stream.type
  }
  await playStreamByConfig(config)
}

// 销毁方法
const destroy = () => {
  stop()
  stopFrameExtract()
  
  // 清理所有流播放器实例
  streamPlayers.forEach((player) => {
    if (player) {
      // 对于ZLM RTC实例，使用close方法
      if (typeof player.close === 'function') {
        try {
          player.close()
        } catch (error) {
          console.warn('ZLM RTC: 销毁时清理实例失败', error)
        }
      } else if (typeof player.destroy === 'function') {
        player.destroy()
      }
    }
  })
  streamPlayers.clear()
  
  // 清理全局ZLM RTC实例
  if (zlmRtcPlayer) {
    try {
      zlmRtcPlayer.close()
    } catch (error) {
      console.warn('ZLM RTC: 销毁时清理全局实例失败', error)
    }
    zlmRtcPlayer = null
  }
  
  if (hideControlsTimer.value) {
    clearTimeout(hideControlsTimer.value)
  }
}

// 监听配置变化
watch(() => props.streams, (newStreams) => {
  if (newStreams && newStreams.length > 0) {
    const multiConfig = createMultiStreamConfig(newStreams)
    availableStreams.value = multiConfig.streams
    
    if (availableStreams.value.length > 0 && !currentStreamId.value) {
      currentStreamId.value = availableStreams.value[0].id
    }
    
    if (status.value !== PlayerStatus.IDLE) {
      stop()
      nextTick(() => {
        play()
      })
    }
  }
}, { deep: true })

// 生命周期
onMounted(() => {
  // 初始化配置
  initializeConfig()
  
  // 自动播放
  if (globalConfig.value.autoplay && availableStreams.value.length > 0) {
    play()
  }
  
  // 鼠标移动显示控制栏
  if (playerContainer.value) {
    playerContainer.value.addEventListener('mousemove', resetHideTimer)
    playerContainer.value.addEventListener('mouseleave', () => {
      controlsVisible.value = false
    })
  }
})

onUnmounted(() => {
  // 停止监控
  if (monitoringEnabled.value) {
    stopMonitoring()
  }
  
  // 停止重连
  reconnectManager.stopReconnect()
  
  destroy()
})
</script>

<style scoped>
.universal-player {
  position: relative;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.player-container {
  position: relative;
  width: 100%;
  height: 100%;
}

video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  z-index: 10;
}

.custom-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 5;
}

.custom-overlay > * {
  pointer-events: auto;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #333;
  border-top: 4px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text,
.error-message {
  font-size: 16px;
  margin-bottom: 16px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.retry-button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.retry-button:hover {
  background: #0056b3;
}

.controls-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: opacity 0.3s ease;
  opacity: 0;
  z-index: 20;
}

.controls-bar.controls-visible {
  opacity: 1;
}

.controls-left,
.controls-center,
.controls-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s ease;
}

.control-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.time-display {
  color: white;
  font-size: 14px;
  font-family: monospace;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-slider {
  width: 80px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
}

.stream-selector {
  margin-right: 8px;
}

.stream-select {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  transition: background 0.2s ease;
}

.stream-select:hover {
  background: rgba(255, 255, 255, 0.3);
}

.stream-select option {
  background: #333;
  color: white;
}

.stats-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 30;
}

.stats-item {
  margin-bottom: 4px;
}

.stats-item:last-child {
  margin-bottom: 0;
}

/* 视频流轮播样式 */
.stream-carousel {
  position: absolute;
  bottom: 60px; /* 在控制栏上方 */
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  padding: 16px;
  z-index: 15; /* 在视频上方，但在控制栏下方 */
  transition: opacity 0.3s ease;
  opacity: 0;
}

.stream-carousel.carousel-visible {
  opacity: 1;
}

.carousel-container {
  position: relative;
  max-width: 100%;
  margin: 0 auto;
}

.carousel-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.6);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  z-index: 2;
  transition: background 0.2s ease;
}

.carousel-nav:hover {
  background: rgba(0, 0, 0, 0.8);
}

.carousel-nav:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.carousel-nav.carousel-prev {
  left: -16px;
}

.carousel-nav.carousel-next {
  right: -16px;
}

.carousel-wrapper {
  overflow: hidden;
  border-radius: 8px;
}

.carousel-track {
  display: flex;
  gap: 12px;
  transition: transform 0.3s ease;
  padding: 8px 0;
}

.stream-thumbnail {
  flex-shrink: 0;
  width: 120px;
  height: 68px;
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  background: rgba(0, 0, 0, 0.6);
}

.stream-thumbnail:hover {
  transform: scale(1.05);
  border-color: rgba(255, 255, 255, 0.5);
}

.stream-thumbnail.active {
  border-color: #007bff;
  box-shadow: 0 0 8px rgba(0, 123, 255, 0.5);
}

.stream-thumbnail.active {
  border-color: #007bff;
  box-shadow: 0 0 8px rgba(0, 123, 255, 0.5);
}

.thumbnail-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #333, #555);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  text-align: center;
}

.thumbnail-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 6px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.stream-thumbnail:hover .thumbnail-overlay {
  opacity: 1;
}

.stream-thumbnail.active .thumbnail-overlay {
  opacity: 1;
  background: rgba(0, 123, 255, 0.3);
}

.thumbnail-container {
  position: relative;
  width: 100%;
  height: calc(100% - 20px); /* 为名称预留空间 */
}

.thumbnail-status {
  position: absolute;
  bottom: 4px;
  left: 4px;
  right: 4px;
  font-size: 10px;
  color: white;
  background: rgba(0, 0, 0, 0.7);
  padding: 2px 4px;
  border-radius: 2px;
  text-align: center;
}

.thumbnail-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  font-size: 10px;
  color: white;
  background: rgba(0, 0, 0, 0.8);
  padding: 2px 4px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thumbnail-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
}

.loading-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.default-thumbnail {
  font-size: 24px;
  color: rgba(255, 255, 255, 0.7);
}

.play-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: rgba(0, 123, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 10px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stream-carousel {
    bottom: 50px;
    padding: 12px;
  }
  
  .stream-thumbnail {
    width: 100px;
    height: 56px;
  }
  
  .carousel-nav {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }
  
  .carousel-nav.prev {
    left: -12px;
  }
  
  .carousel-nav.next {
    right: -12px;
  }
}
</style>
