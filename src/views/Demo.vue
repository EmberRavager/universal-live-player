<template>
  <div class="demo-page">
    <header class="header">
      <h1>通用直播视频播放器</h1>
      <p>支持多种视频流协议的通用播放器组件</p>
    </header>
    
    <main class="main">
      <div class="config-panel">
        <h2>播放器配置</h2>
        
        <div class="form-group">
          <label>视频流URL:</label>
          <input 
            v-model="config.url" 
            type="text" 
            placeholder="请输入视频流URL"
            class="input"
          />
        </div>
        
        <div class="form-group">
          <label>视频流类型:</label>
          <select v-model="config.type" class="select">
            <option value="webrtc">WebRTC (SRS)</option>
            <option value="zlm_rtc">ZLM RTC</option>
            <option value="rtmp">RTMP</option>
            <option value="rtsp">RTSP</option>
            <option value="gb28181">GB28181</option>
            <option value="hls">HLS</option>
            <option value="flv">FLV</option>
          </select>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>宽度:</label>
            <input 
              v-model.number="config.width" 
              type="number" 
              min="320"
              class="input"
            />
          </div>
          <div class="form-group">
            <label>高度:</label>
            <input 
              v-model.number="config.height" 
              type="number" 
              min="240"
              class="input"
            />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>
              <input 
                v-model="config.autoplay" 
                type="checkbox"
                class="checkbox"
              />
              自动播放
            </label>
          </div>
          <div class="form-group">
            <label>
              <input 
                v-model="config.muted" 
                type="checkbox"
                class="checkbox"
              />
              静音
            </label>
          </div>
          <div class="form-group">
            <label>
              <input 
                v-model="showControls" 
                type="checkbox"
                class="checkbox"
              />
              显示控制栏
            </label>
          </div>
          <div class="form-group">
            <label>
              <input 
                v-model="showStats" 
                type="checkbox"
                class="checkbox"
              />
              显示统计信息
            </label>
          </div>
        </div>
        
        <div class="button-group">
          <button @click="applyConfig" class="button primary">应用配置</button>
          <button @click="resetConfig" class="button">重置</button>
        </div>
        
        <div class="multi-stream-config">
          <h3>多视频流配置</h3>
          <div class="form-group">
            <label>
              <input 
                v-model="enableMultiStream" 
                type="checkbox"
                class="checkbox"
              />
              启用多视频流模式
            </label>
          </div>
          
          <div v-if="enableMultiStream" class="stream-list">
            <div class="stream-item" v-for="(stream, index) in multiStreamConfig.streams" :key="stream.id">
              <div class="stream-header">
                <span class="stream-title">视频流 {{ index + 1 }}</span>
                <button @click="removeStreamConfig(index)" class="button small danger">删除</button>
              </div>
              <div class="stream-config">
                <div class="form-group">
                  <label>流ID:</label>
                  <input v-model="stream.id" type="text" class="input" />
                </div>
                <div class="form-group">
                  <label>名称:</label>
                  <input v-model="stream.name" type="text" class="input" />
                </div>
                <div class="form-group">
                  <label>URL:</label>
                  <input v-model="stream.url" type="text" class="input" />
                </div>
                <div class="form-group">
                  <label>类型:</label>
                  <select v-model="stream.type" class="select">
                    <option value="webrtc">WebRTC (SRS)</option>
                    <option value="zlm_rtc">ZLM RTC</option>
                    <option value="rtmp">RTMP</option>
                    <option value="rtsp">RTSP</option>
                    <option value="gb28181">GB28181</option>
                    <option value="hls">HLS</option>
                    <option value="flv">FLV</option>
                  </select>
                </div>
              </div>
            </div>
            
            <button @click="addStreamConfig" class="button">添加视频流</button>
          </div>
        </div>

        <div class="preset-urls">
          <h3>预设URL (测试用)</h3>
          <div class="preset-item" v-for="preset in presetUrls" :key="preset.name">
            <span class="preset-name">{{ preset.name }}</span>
            <span class="preset-type">{{ preset.type }}</span>
            <button @click="loadPreset(preset)" class="button small">加载</button>
          </div>
          
          <div class="preset-multi-streams">
            <h4>多流预设</h4>
            <button @click="loadMultiStreamPreset" class="button small">加载多流演示</button>
          </div>
        </div>
      </div>
      
      <div class="player-panel">
        <h2>播放器</h2>
        <div class="player-wrapper">
          <UniversalPlayer
            ref="playerRef"
            :config="finalPlayerConfig"
            :events="playerEvents"
            :show-controls="showControls"
            :show-stats="showStats"
          />
        </div>
        
        <div class="player-info">
          <div class="info-item">
            <strong>状态:</strong> {{ playerStatus }}
          </div>
          <div class="info-item">
            <strong>当前时间:</strong> {{ formatTime(currentTime) }}
          </div>
          <div class="info-item">
            <strong>音量:</strong> {{ Math.round(currentVolume * 100) }}%
          </div>
          <div class="info-item">
            <strong>多流模式:</strong> {{ enableMultiStream ? '启用' : '禁用' }}
          </div>
          <div class="info-item" v-if="enableMultiStream">
            <strong>视频流数量:</strong> {{ multiStreamConfig.streams.length }}
          </div>
          <div class="info-item" v-if="enableMultiStream">
            <strong>当前配置:</strong> {{ JSON.stringify(finalPlayerConfig.multiStream, null, 2) }}
          </div>
          <div class="info-item" v-if="enableMultiStream">
            <strong>ZLM RTC流:</strong> {{ multiStreamConfig.streams.filter(s => s.type === 'zlm_rtc').map(s => s.name).join(', ') || '无' }}
          </div>
        </div>
        
        <div class="action-buttons">
          <button @click="playVideo" class="button">播放</button>
          <button @click="pauseVideo" class="button">暂停</button>
          <button @click="stopVideo" class="button">停止</button>
          <button @click="refreshVideo" class="button">刷新</button>
          <button @click="takeScreenshot" class="button">截图</button>
          <button @click="toggleFrameExtract" class="button">
            {{ isExtracting ? '停止抽帧' : '开始抽帧' }}
          </button>
        </div>
      </div>
    </main>
    
    <div class="logs-panel">
      <h3>事件日志</h3>
      <div class="logs-container">
        <div 
          v-for="(log, index) in logs" 
          :key="index" 
          class="log-item"
          :class="log.type"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
      <button @click="clearLogs" class="button small">清空日志</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import UniversalPlayer from '@/components/UniversalPlayer.vue'
import { PlayerConfig, PlayerEvents, PlayerStatus, StreamType, MultiStreamConfig, StreamConfig } from '@/types'
import { formatTime } from '@/utils'

// 播放器引用
const playerRef = ref<InstanceType<typeof UniversalPlayer>>()

// 配置数据
const config = reactive<PlayerConfig>({
  url: '',
  type: StreamType.WEBRTC,
  width: 800,
  height: 450,
  autoplay: false,
  muted: false
})

const playerConfig = reactive<PlayerConfig>({ ...config })
const showControls = ref(true)
const showStats = ref(false)

// 多视频流配置
const enableMultiStream = ref(true)
const multiStreamConfig = reactive<MultiStreamConfig>({
  streams: [
    {
      id: 'stream1',
      name: 'ZLM RTC 流 1',
      type: StreamType.ZLM_RTC,
      url: 'ws://localhost:8080/index/api/webrtc?app=live&stream=test1&type=play',
      poster: ''
    },
    {
      id: 'stream2', 
      name: 'ZLM RTC 流 2',
      type: StreamType.ZLM_RTC,
      url: 'ws://localhost:8080/index/api/webrtc?app=live&stream=test2&type=play',
      poster: ''
    },
    {
      id: 'stream3',
      name: 'HLS 流',
      type: StreamType.HLS,
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      poster: ''
    }
  ],
  defaultStreamId: 'stream1'
})

// 播放器状态
const playerStatus = ref<PlayerStatus>(PlayerStatus.IDLE)
const currentTime = ref(0)
const currentVolume = ref(1)
const isExtracting = ref(false)

// 日志
interface LogItem {
  time: string
  message: string
  type: 'info' | 'error' | 'success'
}

const logs = ref<LogItem[]>([])

const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
  logs.value.push({
    time: new Date().toLocaleTimeString(),
    message,
    type
  })
  
  // 限制日志数量
  if (logs.value.length > 100) {
    logs.value.shift()
  }
}

// 播放器事件
const playerEvents: PlayerEvents = {
  onLoadStart: () => {
    addLog('开始加载视频流', 'info')
  },
  onLoadEnd: () => {
    addLog('视频流加载完成', 'success')
  },
  onPlay: () => {
    addLog('开始播放', 'success')
    playerStatus.value = PlayerStatus.PLAYING
  },
  onPause: () => {
    addLog('播放暂停', 'info')
    playerStatus.value = PlayerStatus.PAUSED
  },
  onStop: () => {
    addLog('播放停止', 'info')
    playerStatus.value = PlayerStatus.STOPPED
  },
  onError: (error) => {
    addLog(`播放错误: ${error.message}`, 'error')
    playerStatus.value = PlayerStatus.ERROR
  },
  onTimeUpdate: (time) => {
    currentTime.value = time
  },
  onVolumeChange: (volume) => {
    currentVolume.value = volume
    addLog(`音量变更: ${Math.round(volume * 100)}%`, 'info')
  },
  onScreenshot: (dataUrl) => {
    addLog('截图成功', 'success')
    // 可以在这里处理截图数据
  },
  onFrameExtract: (frameData) => {
    addLog('抽帧数据获取', 'info')
    // 可以在这里处理抽帧数据
  },
  onStreamSwitch: (streamId) => {
    addLog(`切换到视频流: ${streamId}`, 'success')
  }
}

// 预设URL
const presetUrls = [
  {
    name: 'WebRTC 测试流 (SRS)',
    type: StreamType.WEBRTC,
    url: 'http://localhost:1985/rtc/v1/whep/?app=live&stream=livestream'
  },
  {
    name: 'ZLM RTC 测试流',
    type: StreamType.ZLM_RTC,
    url: 'http://localhost:8080/index/api/webrtc?app=live&stream=test&type=play'
  },
  {
    name: 'RTMP 测试流',
    type: StreamType.RTMP,
    url: 'rtmp://localhost:1935/live/test'
  },
  {
    name: 'HLS 测试流',
    type: StreamType.HLS,
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
  },
  {
    name: 'Big Buck Bunny (MP4)',
    type: StreamType.HLS,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  }
]

// 方法
const applyConfig = () => {
  Object.assign(playerConfig, config)
  addLog('配置已应用', 'success')
}

const resetConfig = () => {
  config.url = ''
  config.type = StreamType.WEBRTC
  config.width = 800
  config.height = 450
  config.autoplay = false
  config.muted = false
  addLog('配置已重置', 'info')
}

const loadPreset = (preset: typeof presetUrls[0]) => {
  config.url = preset.url
  config.type = preset.type
  addLog(`加载预设: ${preset.name}`, 'info')
}

const playVideo = () => {
  playerRef.value?.play()
}

const pauseVideo = () => {
  playerRef.value?.pause()
}

const stopVideo = () => {
  playerRef.value?.stop()
}

const refreshVideo = () => {
  playerRef.value?.refresh()
  addLog('刷新播放器', 'info')
}

const takeScreenshot = async () => {
  try {
    const url = await playerRef.value?.screenshot()
    addLog('截图成功', 'success')
  } catch (error) {
    addLog(`截图失败: ${error}`, 'error')
  }
}

const toggleFrameExtract = () => {
  if (isExtracting.value) {
    playerRef.value?.stopFrameExtract()
    isExtracting.value = false
    addLog('停止抽帧', 'info')
  } else {
    playerRef.value?.startFrameExtract({
      interval: 2,
      maxFrames: 10
    })
    isExtracting.value = true
    addLog('开始抽帧 (每2秒一帧，最多10帧)', 'info')
  }
}

const clearLogs = () => {
  logs.value = []
}

// 多视频流相关方法
const addStreamConfig = () => {
  const newStream: StreamConfig = {
    id: `stream_${Date.now()}`,
    name: `视频流 ${multiStreamConfig.streams.length + 1}`,
    url: '',
    type: StreamType.WEBRTC
  }
  multiStreamConfig.streams.push(newStream)
  addLog(`添加新视频流: ${newStream.name}`, 'info')
}

const removeStreamConfig = (index: number) => {
  const stream = multiStreamConfig.streams[index]
  multiStreamConfig.streams.splice(index, 1)
  addLog(`删除视频流: ${stream.name}`, 'info')
}

const loadMultiStreamPreset = () => {
  enableMultiStream.value = true
  multiStreamConfig.streams = [
    {
      id: 'stream1',
      name: 'WebRTC 流 1',
      url: 'http://localhost:1985/rtc/v1/whep/?app=live&stream=stream1',
      type: StreamType.WEBRTC
    },
    {
      id: 'stream2', 
      name: 'ZLM RTC 流',
      url: 'http://localhost:8080/index/api/webrtc?app=live&stream=test&type=play',
      type: StreamType.ZLM_RTC
    },
    {
      id: 'stream3',
      name: 'HLS 测试流',
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      type: StreamType.HLS
    }
  ]
  multiStreamConfig.defaultStreamId = 'stream1'
  
  // 更新播放器配置为多流模式
  Object.assign(playerConfig, {
    ...config,
    enableMultiStream: true,
    multiStream: multiStreamConfig
  })
  
  addLog('加载多视频流演示配置', 'success')
}

// 计算属性：当前播放器配置
const finalPlayerConfig = computed(() => {
  if (enableMultiStream.value && multiStreamConfig.streams.length > 0) {
    return {
      ...playerConfig,
      enableMultiStream: true,
      multiStream: multiStreamConfig
    }
  }
  return playerConfig
})

// 初始化
addLog('播放器初始化完成', 'success')
</script>

<style scoped>
.demo-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h1 {
  color: #333;
  margin-bottom: 8px;
}

.header p {
  color: #666;
  font-size: 16px;
}

.main {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

.config-panel,
.player-panel {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.config-panel h2,
.player-panel h2 {
  margin-bottom: 20px;
  color: #333;
  font-size: 18px;
}

.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #555;
}

.input,
.select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.input:focus,
.select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.checkbox {
  margin-right: 8px;
}

.button-group {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  color: #333;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.button:hover {
  background: #f8f9fa;
}

.button.primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.button.primary:hover {
  background: #0056b3;
}

.button.small {
  padding: 4px 8px;
  font-size: 12px;
}

.preset-urls h3 {
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}

.preset-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 8px;
}

.preset-name {
  flex: 1;
  font-weight: 500;
}

.preset-type {
  color: #666;
  font-size: 12px;
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 3px;
}

/* 多视频流配置样式 */
.multi-stream-config {
  margin-bottom: 24px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.multi-stream-config h3 {
  margin-bottom: 16px;
  color: #333;
  font-size: 16px;
}

.stream-list {
  margin-top: 16px;
}

.stream-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin-bottom: 16px;
  overflow: hidden;
}

.stream-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.stream-title {
  font-weight: 500;
  color: #333;
}

.stream-config {
  padding: 16px;
}

.stream-config .form-group {
  margin-bottom: 12px;
}

.stream-config .form-group:last-child {
  margin-bottom: 0;
}

.button.small {
  padding: 4px 8px;
  font-size: 12px;
}

.button.danger {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.button.danger:hover {
  background: #c82333;
  border-color: #bd2130;
}

.preset-multi-streams {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.preset-multi-streams h4 {
  margin-bottom: 8px;
  color: #333;
  font-size: 14px;
}

.player-wrapper {
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.player-info {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
}

.info-item {
  font-size: 14px;
  color: #555;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.logs-panel {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.logs-panel h3 {
  margin-bottom: 16px;
  color: #333;
  font-size: 16px;
}

.logs-container {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fafafa;
}

.log-item {
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
  font-size: 13px;
  font-family: monospace;
}

.log-item:last-child {
  margin-bottom: 0;
}

.log-time {
  color: #666;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-item.info .log-message {
  color: #333;
}

.log-item.success .log-message {
  color: #28a745;
}

.log-item.error .log-message {
  color: #dc3545;
}

@media (max-width: 1024px) {
  .main {
    grid-template-columns: 1fr;
  }
  
  .player-info {
    grid-template-columns: 1fr;
  }
}
</style>