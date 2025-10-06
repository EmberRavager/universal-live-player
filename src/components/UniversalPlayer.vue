<template>
  <div class="universal-player" :style="playerStyle">
    <div class="player-container" ref="playerContainer">
      <!-- 视频播放区域 -->
      <video
        ref="videoElement"
        :width="config.width"
        :height="config.height"
        :poster="config.poster"
        :muted="config.muted"
        :autoplay="config.autoplay"
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
      
      <!-- 控制栏 -->
      <div v-if="showControls" class="controls-bar" :class="{ 'controls-visible': controlsVisible }">
        <div class="controls-left">
          <button @click="togglePlay" class="control-button">
            {{ status === PlayerStatus.PLAYING ? '⏸️' : '▶️' }}
          </button>
          <button @click="stop" class="control-button">⏹️</button>
          <button @click="refresh" class="control-button">🔄</button>
          <span class="time-display">{{ formatTime(currentTime) }}</span>
        </div>
        
        <div class="controls-center">
          <div class="volume-control">
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
          <div v-if="isMultiStreamMode && availableStreams.length > 1" class="stream-selector">
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
          <button @click="screenshot" class="control-button" title="截图">📷</button>
          <button @click="toggleFrameExtract" class="control-button" title="抽帧">
            {{ isExtracting ? '⏹️' : '🎞️' }}
          </button>
          <button @click="toggleFullscreen" class="control-button">⛶</button>
        </div>
      </div>
    </div>
    
    <!-- 统计信息 -->
    <div v-if="showStats" class="stats-panel">
      <div class="stats-item">状态: {{ status }}</div>
      <div class="stats-item">类型: {{ config.type }}</div>
      <div class="stats-item" v-if="stats.bitrate">码率: {{ stats.bitrate }}kbps</div>
      <div class="stats-item" v-if="stats.fps">帧率: {{ stats.fps }}fps</div>
      <div class="stats-item" v-if="stats.resolution">
        分辨率: {{ stats.resolution.width }}x{{ stats.resolution.height }}
      </div>
    </div>
    
    <!-- 视频流轮播组件 -->
    <div v-if="isMultiStreamMode && availableStreams.length > 1" class="stream-carousel">
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
                
                <!-- 播放状态指示器 -->
                <div v-if="stream.id === currentStreamId" class="play-indicator">
                  <div class="play-icon">▶</div>
                </div>
              </div>
              
              <div class="stream-info">
                <div class="stream-name">{{ stream.name }}</div>
                <div class="stream-status">
                  {{ getStreamStatus(stream.id) }}
                </div>
              </div>
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
  MultiStreamConfig
} from '@/types'
import { 
  formatTime, 
  captureVideoFrame, 
  canvasToBlob, 
  downloadFile, 
  loadScript,
  debounce
} from '@/utils'

interface Props {
  config: PlayerConfig
  events?: PlayerEvents
  showControls?: boolean
  showStats?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showControls: true,
  showStats: false
})

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
const isMultiStreamMode = ref(false)
const streamLoadingStates = reactive<Record<string, boolean>>({})

// 轮播相关
const carouselWrapper = ref<HTMLElement>()
const carouselTrack = ref<HTMLElement>()
const carouselScrollLeft = ref(0)
const maxScrollLeft = ref(0)
const thumbnailRefs = reactive<Record<string, HTMLVideoElement>>({})

// 轮播配置
const THUMBNAIL_WIDTH = 160 // 缩略图宽度
const THUMBNAIL_GAP = 12 // 缩略图间距
const SCROLL_STEP = THUMBNAIL_WIDTH + THUMBNAIL_GAP // 滚动步长

// WebRTC 相关
let webrtcPlayer: any = null
let jswebrtcPlayer: any = null
let zlmRtcPlayer: any = null
let frameExtractTimer: number | null = null

// 多视频流播放器实例映射
const streamPlayers = new Map<string, any>()

// 计算属性
const playerStyle = computed(() => ({
  width: typeof props.config.width === 'number' ? `${props.config.width}px` : props.config.width,
  height: typeof props.config.height === 'number' ? `${props.config.height}px` : props.config.height
}))

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
  }
}

// 暴露播放器实例
defineExpose(playerInstance)

// 事件处理
const handleLoadStart = () => {
  console.log('视频元素: loadstart事件, 当前类型:', props.config.type)
  status.value = PlayerStatus.LOADING
  props.events?.onLoadStart?.()
}

const handleLoadedData = () => {
  console.log('视频元素: loadeddata事件, 当前类型:', props.config.type, '当前状态:', status.value)
  // 对于WebRTC类型的播放，不要重置状态为IDLE
  // 因为WebRTC的状态由其自己的事件管理
  if (props.config.type !== StreamType.WEBRTC && props.config.type !== StreamType.ZLM_RTC) {
    console.log('视频元素: 非WebRTC类型，设置状态为IDLE')
    status.value = PlayerStatus.IDLE
  } else {
    console.log('视频元素: WebRTC类型，保持当前状态:', status.value)
  }
  props.events?.onLoadEnd?.()
}

const handlePlay = () => {
  console.log('视频元素: play事件, 当前类型:', props.config.type, '当前状态:', status.value)
  // 对于WebRTC类型，状态由其自己的事件管理
  // 但如果当前状态不是PLAYING，则更新状态
  if (props.config.type !== StreamType.WEBRTC && props.config.type !== StreamType.ZLM_RTC) {
    console.log('视频元素: 非WebRTC类型，设置状态为PLAYING')
    status.value = PlayerStatus.PLAYING
    props.events?.onPlay?.()
  } else if (status.value !== PlayerStatus.PLAYING) {
    console.log('视频元素: WebRTC类型但状态不是PLAYING，触发onPlay事件')
    props.events?.onPlay?.()
  } else {
    console.log('视频元素: WebRTC类型且状态已是PLAYING')
  }
}

const handlePause = () => {
  status.value = PlayerStatus.PAUSED
  props.events?.onPause?.()
}

const handleError = (event: Event) => {
  status.value = PlayerStatus.ERROR
  const error = new Error('视频播放错误')
  errorMessage.value = error.message
  props.events?.onError?.(error)
}

const handleTimeUpdate = () => {
  if (videoElement.value) {
    currentTime.value = videoElement.value.currentTime
    props.events?.onTimeUpdate?.(currentTime.value)
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
  }
}

// 播放控制方法
const play = async () => {
  try {
    status.value = PlayerStatus.LOADING
    
    // 初始化多视频流
    initializeMultiStream()
    
    if (isMultiStreamMode.value && currentStreamId.value) {
      const currentStream = availableStreams.value.find(s => s.id === currentStreamId.value)
      if (currentStream) {
        await playStreamByConfig({
          ...props.config,
          url: currentStream.url,
          type: currentStream.type
        })
      } else {
        throw new Error('未找到可播放的视频流')
      }
    } else {
      // 单流模式
      switch (props.config.type) {
        case StreamType.WEBRTC:
          await playWebRTC()
          break
        case StreamType.ZLM_RTC:
          await playZLMRTC()
          break
        case StreamType.RTMP:
        case StreamType.RTSP:
        case StreamType.GB28181:
          await playStreaming()
          break
        case StreamType.HLS:
        case StreamType.FLV:
          await playNative()
          break
        default:
          throw new Error(`不支持的视频流类型: ${props.config.type}`)
      }
    }
  } catch (error) {
    status.value = PlayerStatus.ERROR
    errorMessage.value = error instanceof Error ? error.message : '播放失败'
    props.events?.onError?.(error instanceof Error ? error : new Error('播放失败'))
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
  webrtcPlayer.pc.onconnectionstatechange = () => {
    console.log('WebRTC连接状态:', webrtcPlayer.pc.connectionState)
    if (webrtcPlayer.pc.connectionState === 'connected') {
      status.value = PlayerStatus.PLAYING
    } else if (webrtcPlayer.pc.connectionState === 'failed') {
      status.value = PlayerStatus.ERROR
      emitEvent('onError', new Error('WebRTC连接失败'))
    }
  }
  
  try {
    const playUrl = config?.url || getCurrentPlayUrl()
    await webrtcPlayer.play(playUrl)
    console.log('WebRTC播放请求已发送')
  } catch (error) {
    console.error('WebRTC播放失败:', error)
    status.value = PlayerStatus.ERROR
    emitEvent('onError', error)
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
    useCamera: false,
    audioEnable: true,
    videoEnable: true,
    recvOnly: true,
    resolution: { w: 1280, h: 720 },
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
  
  zlmRtcPlayer.on(window.ZLMRTCClient.Events.WEBRTC_ON_CONNECTION_STATE_CHANGE, (state: any) => {
    console.log('ZLM RTC: 连接状态变化', state)
    if (state === 'connected') {
      console.log('ZLM RTC: 连接已建立')
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
      errorMessage.value = '连接断开'
      props.events?.onError?.(new Error(`连接状态: ${state}`))
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
    errorMessage.value = error instanceof Error ? error.message : 'ZLM RTC连接失败'
    props.events?.onError?.(error instanceof Error ? error : new Error('ZLM RTC连接失败'))
    throw error
  }
}

const playStreaming = async (config?: PlayerConfig) => {
  await loadScript('/vendors/jswebrtc.min.js')
  
  if (!window.jswebrtc) {
    throw new Error('jswebrtc 库加载失败')
  }
  
  if (jswebrtcPlayer) {
    jswebrtcPlayer.destroy()
  }
  
  const playUrl = config?.url || getCurrentPlayUrl()
  
  jswebrtcPlayer = new window.jswebrtc.Player({
    element: videoElement.value,
    url: playUrl
  })
  
  await jswebrtcPlayer.play()
  status.value = PlayerStatus.PLAYING
}

const playNative = async (config?: PlayerConfig) => {
  if (videoElement.value) {
    const playUrl = config?.url || getCurrentPlayUrl()
    videoElement.value.src = playUrl
    await videoElement.value.play()
    status.value = PlayerStatus.PLAYING
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
  const step = direction === 'left' ? -SCROLL_STEP : SCROLL_STEP
  const newScrollLeft = Math.max(0, Math.min(maxScrollLeft.value, carouselScrollLeft.value + step))
  carouselScrollLeft.value = newScrollLeft
}

const updateCarouselScrollLimits = () => {
  if (carouselWrapper.value && carouselTrack.value) {
    const wrapperWidth = carouselWrapper.value.clientWidth
    const trackWidth = carouselTrack.value.scrollWidth
    maxScrollLeft.value = Math.max(0, trackWidth - wrapperWidth)
  }
}



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
  if (isMultiStreamMode.value && currentStreamId.value) {
    const currentStream = availableStreams.value.find(s => s.id === currentStreamId.value)
    return currentStream?.url || props.config.url
  }
  return props.config.url
}

// 多视频流管理函数
const initializeMultiStream = () => {
  if (props.config.enableMultiStream && props.config.multiStream) {
    isMultiStreamMode.value = true
    availableStreams.value = props.config.multiStream.streams.filter(stream => stream.enabled !== false)
    
    // 设置默认流
    if (props.config.multiStream.defaultStreamId) {
      currentStreamId.value = props.config.multiStream.defaultStreamId
    } else if (availableStreams.value.length > 0) {
      currentStreamId.value = availableStreams.value[0].id
    }
  } else if (props.config.url && props.config.type) {
    // 单流模式
    isMultiStreamMode.value = false
    availableStreams.value = [{
      id: 'default',
      name: '默认流',
      url: props.config.url,
      type: props.config.type,
      enabled: true
    }]
    currentStreamId.value = 'default'
  }
}

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
    if (streamPlayers.has(streamId)) {
      const existingPlayer = streamPlayers.get(streamId)
      console.log(`多流切换: 找到已存在的播放器实例 ${streamId}`)
      if (existingPlayer && await resumePlayerInstance(existingPlayer, targetStream)) {
        status.value = PlayerStatus.PLAYING
        streamLoadingStates[streamId] = false
        props.events?.onStreamSwitch?.(streamId)
        console.log(`多流切换: 成功恢复播放器实例 ${streamId}`)
        return
      }
    }
    
    // 创建新的播放器实例
    console.log(`多流切换: 创建新的播放器实例 ${streamId}, 类型: ${targetStream.type}`)
    await createNewPlayerInstance(targetStream)
    streamLoadingStates[streamId] = false
    props.events?.onStreamSwitch?.(streamId)
    console.log(`多流切换: 成功创建并切换到流 ${streamId}`)
    
  } catch (error) {
    // 切换失败，回滚到之前的流
    currentStreamId.value = previousStreamId
    streamLoadingStates[streamId] = false
    status.value = PlayerStatus.ERROR
    errorMessage.value = error instanceof Error ? error.message : '切换视频流失败'
    props.events?.onError?.(error instanceof Error ? error : new Error('切换视频流失败'))
  }
}

const playStreamByConfig = async (config: PlayerConfig) => {
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
}

const addStream = (stream: StreamConfig) => {
  const existingIndex = availableStreams.value.findIndex(s => s.id === stream.id)
  if (existingIndex >= 0) {
    availableStreams.value[existingIndex] = stream
  } else {
    availableStreams.value.push(stream)
  }
}

const removeStream = (streamId: string) => {
  const index = availableStreams.value.findIndex(s => s.id === streamId)
  if (index >= 0) {
    availableStreams.value.splice(index, 1)
    
    // 清理该流的播放器实例
    if (streamPlayers.has(streamId)) {
      const player = streamPlayers.get(streamId)
      if (player) {
        // 对于ZLM RTC实例，使用close方法
        if (typeof player.close === 'function') {
          try {
            player.close()
            console.log('ZLM RTC: 实例已清理', streamId)
          } catch (error) {
            console.warn('ZLM RTC: 清理实例失败', error)
          }
        } else if (typeof player.destroy === 'function') {
          player.destroy()
        }
      }
      streamPlayers.delete(streamId)
    }
    
    // 如果删除的是当前播放的流，切换到第一个可用流
    if (currentStreamId.value === streamId && availableStreams.value.length > 0) {
      switchToStream(availableStreams.value[0].id)
    }
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
watch(() => props.config, (newConfig) => {
  // 重新初始化多流模式
  initializeMultiStream()
  
  if (status.value !== PlayerStatus.IDLE) {
    stop()
    nextTick(() => {
      play()
    })
  }
}, { deep: true })

// 生命周期
onMounted(() => {
  if (props.config.autoplay) {
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
  position: relative;
  background: rgba(0, 0, 0, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px;
  margin-top: 8px;
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
}

.stream-thumbnail:hover {
  transform: scale(1.05);
  border-color: rgba(255, 255, 255, 0.3);
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

.thumbnail-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: white;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #28a745;
}

.status-indicator.loading {
  background: #ffc107;
  animation: pulse 1.5s infinite;
}

.status-indicator.error {
  background: #dc3545;
}

.thumbnail-name {
  font-size: 10px;
  color: white;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.play-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: rgba(0, 123, 255, 0.8);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 10px;
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