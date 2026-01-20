<template>
  <div class="demo-page">
    <header class="header">
      <div class="header-content">
        <h1>UniversalPlayer</h1>
        <p class="subtitle">通用直播视频播放器组件</p>
        <p class="description">支持 WebRTC, RTMP, HLS, HTTP-FLV 等多种协议，内置自动重连与多流切换功能。</p>
      </div>
    </header>
    
    <main class="main-container">
      <!-- 左侧：配置与控制 -->
      <aside class="sidebar">
        <!-- 属性配置 -->
        <div class="panel config-panel">
          <div class="panel-header">
            <h3>⚙️ 属性配置 (Props)</h3>
          </div>
          <div class="panel-body">
            <div class="control-group">
              <label class="toggle-label">
                <input type="checkbox" v-model="showControls" />
                <span class="label-text">显示原生控制栏 (show-controls)</span>
              </label>
              <label class="toggle-label">
                <input type="checkbox" v-model="enableAutoReconnect" />
                <span class="label-text">自动重连 (enable-auto-reconnect)</span>
              </label>
            </div>
            
            <div class="control-group">
               <label>控制栏按钮</label>
               <div class="checkbox-grid">
                  <label class="toggle-label"><input type="checkbox" v-model="controlsConfigLocal.showPlay" /> 播放/停止</label>
                  <label class="toggle-label"><input type="checkbox" v-model="controlsConfigLocal.showVolume" /> 音量</label>
                  <label class="toggle-label"><input type="checkbox" v-model="controlsConfigLocal.showFullscreen" /> 全屏</label>
                  <label class="toggle-label"><input type="checkbox" v-model="controlsConfigLocal.showScreenshot" /> 截图</label>
                  <label class="toggle-label"><input type="checkbox" v-model="controlsConfigLocal.showFrameExtract" /> 抽帧</label>
               </div>
            </div>

            <div class="control-group">
              <label>默认尺寸</label>
              <div class="input-row">
                <div class="input-wrapper">
                  <span class="prefix">W</span>
                  <input type="number" v-model.number="globalConfigLocal.defaultWidth" @change="updateGlobalConfig" placeholder="Width" />
                </div>
                <div class="input-wrapper">
                  <span class="prefix">H</span>
                  <input type="number" v-model.number="globalConfigLocal.defaultHeight" @change="updateGlobalConfig" placeholder="Height" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 流管理 -->
        <div class="panel stream-panel">
          <div class="panel-header">
            <h3>📺 视频流管理</h3>
          </div>
          <div class="panel-body">
            <!-- 添加流 -->
            <div class="add-stream-box">
              <div class="input-group">
                <input 
                  v-model="customStreamUrl" 
                  type="text" 
                  placeholder="视频流地址 (URL)"
                  class="full-width"
                />
              </div>
              <div class="input-group row">
                <input 
                  v-model="customStreamName" 
                  type="text" 
                  placeholder="流名称 (可选)"
                  class="flex-1"
                />
                <select v-model="customStreamType" class="select-type">
                  <option value="auto">自动 (Auto)</option>
                  <option value="webrtc">WebRTC</option>
                  <option value="hls">HLS</option>
                  <option value="rtmp">RTMP</option>
                  <option value="flv">FLV</option>
                </select>
              </div>
              <button @click="addCustomStream" class="btn btn-primary full-width" :disabled="!customStreamUrl">
                ➕ 添加至列表
              </button>
            </div>

            <!-- 流列表 -->
            <div class="stream-list">
              <div 
                v-for="stream in demoStreams" 
                :key="stream.id"
                class="stream-item"
                :class="{ active: stream.enabled }"
              >
                <div class="stream-info">
                  <div class="stream-name" :title="stream.name">{{ stream.name }}</div>
                  <div class="stream-meta">
                    <span class="badge">{{ stream.type }}</span>
                  </div>
                </div>
                <button 
                  @click="toggleStream(stream.id)"
                  class="btn-icon"
                  :class="stream.enabled ? 'text-danger' : 'text-success'"
                  :title="stream.enabled ? '移除' : '添加'"
                >
                  {{ stream.enabled ? '➖' : '➕' }}
                </button>
              </div>
              <div v-if="demoStreams.length === 0" class="empty-state">
                暂无视频流
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧：预览与代码 -->
      <div class="content-area">
        <!-- 组件预览 -->
        <div class="panel preview-panel">
          <div class="panel-header">
            <h3>组件预览</h3>
            <div class="status-indicators">
              <span class="status-badge" :class="connectionState.toLowerCase()">
                {{ getConnectionLabel(connectionState) }}
              </span>
            </div>
          </div>
          <div class="panel-body player-container-wrapper">
            <UniversalPlayer
              ref="playerRef"
              :streams="activeStreams"
              :show-controls="showControls"
              :enable-auto-reconnect="enableAutoReconnect"
              :controls-config="controlsConfigLocal"
              @play="onPlay"
              @pause="onPause"
              @stop="onStop"
              @error="onError"
              @stream-switch="onStreamSwitch"
            />
          </div>
          <div class="panel-footer actions-bar">
            <div class="action-group">
              <button @click="playVideo" class="btn btn-sm">▶️ 播放</button>
              <button @click="pauseVideo" class="btn btn-sm">⏸️ 暂停</button>
              <button @click="stopVideo" class="btn btn-sm">⏹️ 停止</button>
              <button @click="refreshVideo" class="btn btn-sm">🔄 刷新</button>
            </div>
            <div class="action-group">
              <button @click="takeScreenshot" class="btn btn-sm">📸 截图</button>
              <button @click="toggleFrameExtract" class="btn btn-sm" :class="{ 'btn-active': isExtracting }">
                {{ isExtracting ? '⏹️ 停止抽帧' : '🎬 开始抽帧' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 代码示例 -->
        <div class="panel code-panel">
          <div class="panel-header">
            <h3>💻 代码示例</h3>
            <button @click="copyCode" class="btn btn-xs btn-outline">📋 复制</button>
          </div>
          <div class="panel-body code-body">
            <pre><code>{{ generatedCode }}</code></pre>
          </div>
        </div>

        <!-- 文档说明 -->
        <div class="panel doc-panel">
          <div class="panel-header">
            <h3>📖 组件文档 (Documentation)</h3>
          </div>
          <div class="panel-body">
            <div class="doc-section">
              <h4>Props (属性)</h4>
              <table class="doc-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>类型</th>
                    <th>默认值</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>streams</code></td>
                    <td>StreamConfig[]</td>
                    <td>[]</td>
                    <td>视频流配置列表，包含 id, name, url, type 等信息</td>
                  </tr>
                  <tr>
                    <td><code>show-controls</code></td>
                    <td>boolean</td>
                    <td>true</td>
                    <td>是否显示原生/自定义控制栏</td>
                  </tr>
                  <tr>
                    <td><code>enable-auto-reconnect</code></td>
                    <td>boolean</td>
                    <td>true</td>
                    <td>是否启用断线自动重连</td>
                  </tr>
                  <tr>
                    <td><code>preset</code></td>
                    <td>string</td>
                    <td>'multiStream'</td>
                    <td>配置预设，可选值: 'default', 'lowLatency', 'multiStream'</td>
                  </tr>
                  <tr>
                    <td><code>controls-config</code></td>
                    <td>Object</td>
                    <td>(All true)</td>
                    <td>细粒度控制栏按钮显示 (showPlay, showVolume, etc.)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="doc-section">
              <h4>Slots (插槽)</h4>
              <table class="doc-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                   <tr>
                    <td><code>#overlay</code></td>
                    <td>视频画面上层的自定义覆盖层</td>
                  </tr>
                  <tr>
                    <td><code>#controls-left</code></td>
                    <td>控制栏左侧自定义内容</td>
                  </tr>
                  <tr>
                    <td><code>#controls-right</code></td>
                    <td>控制栏右侧自定义内容</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="doc-section">
              <h4>Events (事件)</h4>
              <table class="doc-table">
                <thead>
                  <tr>
                    <th>事件名</th>
                    <th>参数</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>@play</code></td>
                    <td>-</td>
                    <td>视频开始播放时触发</td>
                  </tr>
                  <tr>
                    <td><code>@pause</code></td>
                    <td>-</td>
                    <td>视频暂停时触发</td>
                  </tr>
                  <tr>
                    <td><code>@error</code></td>
                    <td>Error</td>
                    <td>播放发生错误时触发</td>
                  </tr>
                   <tr>
                    <td><code>@stream-switch</code></td>
                    <td>streamId, stream</td>
                    <td>切换视频流时触发</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import UniversalPlayer from '@/components/UniversalPlayer.vue'
import { StreamType, PlayerEvents, PlayerStatus } from '@/types'
import { playerConfigManager } from '@/config/playerConfig'

// --- State ---
const playerRef = ref<InstanceType<typeof UniversalPlayer>>()
const showControls = ref(true)
const enableAutoReconnect = ref(true)

// Player Status
const playerStatus = ref<PlayerStatus>(PlayerStatus.IDLE)
const connectionState = ref('DISCONNECTED')
const isExtracting = ref(false)

// Custom Stream Input
const customStreamUrl = ref('')
const customStreamName = ref('')
const customStreamType = ref('auto')

// Global Config
const globalConfigLocal = reactive({
  defaultWidth: 800,
  defaultHeight: 450,
  maxRetries: 3,
  retryDelay: 3000
})

const controlsConfigLocal = reactive({
  showPlay: true,
  showVolume: true,
  showFullscreen: true,
  showScreenshot: true,
  showStreamSelector: true,
  showFrameExtract: true
})

// Streams
const demoStreams = ref<any[]>([])

// --- Computed ---
const activeStreams = computed(() => 
  demoStreams.value.filter(stream => stream.enabled)
)

const generatedCode = computed(() => {
  const streamsCode = activeStreams.value.map(s => `  {
    id: '${s.id}',
    name: '${s.name}',
    url: '${s.url}',
    type: '${s.type}'
  }`).join(',\n')

  // Format controls config
  const controlsConfigStr = JSON.stringify(controlsConfigLocal, null, 2)
    .replace(/"(\w+)":/g, '$1:') // Remove quotes from keys
    .split('\n')
    .map((line, index) => index === 0 ? line : '  ' + line) // Indent
    .join('\n')

  return `<template>
  <UniversalPlayer
    ref="player"
    :streams="streams"
    :show-controls="${showControls.value}"
    :enable-auto-reconnect="${enableAutoReconnect.value}"
    :controls-config="controlsConfig"
    @play="onPlay"
    @error="onError"
  >
    <!-- Slots Example -->
    <!--
    <template #controls-left>
      <button>Custom Btn</button>
    </template>
    -->
  </UniversalPlayer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UniversalPlayer, StreamType } from 'universal-live-player'

const streams = [
${streamsCode}
]

const controlsConfig = ${controlsConfigStr}

const onPlay = () => console.log('Playing')
const onError = (err) => console.error(err)
<\/script>`
})

// --- Methods ---

const updateGlobalConfig = () => {
  if (playerRef.value) {
    playerRef.value.updateGlobalConfig(globalConfigLocal)
  }
}

const addCustomStream = () => {
  if (!customStreamUrl.value.trim()) {
    alert('请输入有效的视频链接')
    return
  }
  
  const streamId = `custom-${Date.now()}`
  const streamName = customStreamName.value.trim() || `Stream ${streamId.slice(-4)}`
  
  // Check duplicates
  const existingStream = demoStreams.value.find(s => s.url === customStreamUrl.value.trim())
  if (existingStream) {
    alert('该视频链接已存在')
    return
  }
  
  demoStreams.value.push({
    id: streamId,
    name: streamName,
    url: customStreamUrl.value.trim(),
    type: customStreamType.value as StreamType,
    enabled: true,
    poster: '/images/custom-poster.jpg'
  })
  
  customStreamUrl.value = ''
  customStreamName.value = ''
}

const toggleStream = (streamId: string) => {
  const stream = demoStreams.value.find(s => s.id === streamId)
  if (stream) {
    stream.enabled = !stream.enabled
  }
}

const copyCode = () => {
  navigator.clipboard.writeText(generatedCode.value)
  // Simple feedback, or use a toast library if available
  console.log('Code copied to clipboard')
}

// Player Controls
const playVideo = () => playerRef.value?.play()
const pauseVideo = () => playerRef.value?.pause()
const stopVideo = () => playerRef.value?.stop()
const refreshVideo = () => playerRef.value?.refresh()

const takeScreenshot = async () => {
  try {
    await playerRef.value?.screenshot()
  } catch (error) {
    console.error('Screenshot failed', error)
  }
}

const toggleFrameExtract = () => {
  if (isExtracting.value) {
    playerRef.value?.stopFrameExtract()
    isExtracting.value = false
  } else {
    playerRef.value?.startFrameExtract({ interval: 2, maxFrames: 10 })
    isExtracting.value = true
  }
}

// Helpers
const getConnectionLabel = (state: string) => {
  const labels: Record<string, string> = {
    'DISCONNECTED': '未连接',
    'CONNECTING': '连接中',
    'CONNECTED': '已连接',
    'RECONNECTING': '重连中',
    'FAILED': '连接失败'
  }
  return labels[state] || state
}

// Events
const onPlay = () => {
  playerStatus.value = PlayerStatus.PLAYING
  console.log('Event: onPlay')
}

const onPause = () => {
  playerStatus.value = PlayerStatus.PAUSED
  console.log('Event: onPause')
}

const onStop = () => {
  playerStatus.value = PlayerStatus.STOPPED
  connectionState.value = 'DISCONNECTED'
  console.log('Event: onStop')
}

const onError = (error: Error) => {
  playerStatus.value = PlayerStatus.ERROR
  connectionState.value = 'FAILED'
  console.error('Event: onError', error)
}

const onStreamSwitch = (streamId: string) => {
  console.log('Event: onStreamSwitch', streamId)
  // Update connection state if needed or rely on internal player state
  if (playerRef.value) {
    connectionState.value = playerRef.value.getConnectionState()
  }
}

// Watchers & Lifecycle
watch(() => globalConfigLocal, () => updateGlobalConfig(), { deep: true })

onMounted(() => {
  const config = playerConfigManager.getGlobalConfig()
  Object.assign(globalConfigLocal, config)
})
</script>

<style scoped>
/* Reset & Base */
* {
  box-sizing: border-box;
}

.demo-page {
  max-width: 1600px;
  margin: 0 auto;
  padding: 40px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #333;
  background-color: #f5f7fa;
  min-height: 100vh;
}

/* Header */
.header {
  margin-bottom: 40px;
  text-align: left;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 20px;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 600;
  margin: 0 0 10px 0;
  color: #1f2f3d;
}

.subtitle {
  font-size: 1.25rem;
  color: #5e6d82;
  margin: 0 0 10px 0;
}

.description {
  color: #909399;
  font-size: 1rem;
}

/* Layout */
.main-container {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 30px;
  align-items: start;
}

/* Panels */
.panel {
  background: white;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
  overflow: hidden;
}

.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fafafa;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.panel-body {
  padding: 20px;
}

.panel-footer {
  padding: 12px 20px;
  background-color: #fcfcfc;
  border-top: 1px solid #ebeef5;
}

/* Sidebar Specifics */
.control-group {
  margin-bottom: 20px;
}

.control-group label {
  display: block;
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
  font-weight: 500;
}

.toggle-label {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  cursor: pointer;
}

.toggle-label input {
  margin-right: 8px;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
  background: #f9fafc;
  padding: 10px;
  border-radius: 4px;
}

.input-row {
  display: flex;
  gap: 10px;
}

.input-wrapper {
  position: relative;
  flex: 1;
}

.input-wrapper .prefix {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #909399;
  font-size: 12px;
}

.input-wrapper input {
  width: 100%;
  padding: 8px 8px 8px 24px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  transition: border-color 0.2s;
}

.input-wrapper input:focus {
  border-color: #409eff;
  outline: none;
}

/* Stream Management */
.add-stream-box {
  margin-bottom: 15px;
  background: #fdfdfd;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

.input-group {
  margin-bottom: 10px;
}

.input-group.row {
  display: flex;
  gap: 8px;
}

.full-width {
  width: 100%;
  padding: 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.flex-1 {
  flex: 1;
  padding: 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.select-type {
  padding: 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: white;
}

.stream-list {
  max-height: 400px;
  overflow-y: auto;
}

.stream-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #ebeef5;
  transition: background-color 0.2s;
}

.stream-item:last-child {
  border-bottom: none;
}

.stream-item:hover {
  background-color: #f5f7fa;
}

.stream-item.active {
  background-color: #ecf5ff;
}

.stream-info {
  overflow: hidden;
}

.stream-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.badge {
  display: inline-block;
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 4px;
  background-color: #f0f2f5;
  color: #909399;
  text-transform: uppercase;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  transition: transform 0.2s;
}

.btn-icon:hover {
  transform: scale(1.1);
}

.text-danger { color: #f56c6c; }
.text-success { color: #67c23a; }

.empty-state {
  text-align: center;
  color: #909399;
  padding: 20px 0;
  font-size: 13px;
}

/* Preview Area */
.player-container-wrapper {
  background: #000;
  min-height: 400px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.actions-bar {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.action-group {
  display: flex;
  gap: 8px;
}

/* Code Panel */
.code-body {
  padding: 0;
  background: #282c34;
  overflow: hidden;
}

.code-body pre {
  margin: 0;
  padding: 20px;
  overflow-x: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #abb2bf;
}

/* Buttons */
.btn {
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-primary {
  background-color: #409eff;
  color: white;
  border-color: #409eff;
}

.btn-primary:hover {
  background-color: #66b1ff;
  border-color: #66b1ff;
}

.btn-primary:disabled {
  background-color: #a0cfff;
  border-color: #a0cfff;
  cursor: not-allowed;
}

.btn-outline {
  background: white;
  border-color: #dcdfe6;
  color: #606266;
}

.btn-outline:hover {
  color: #409eff;
  border-color: #c6e2ff;
  background-color: #ecf5ff;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
  background-color: white;
  border: 1px solid #dcdfe6;
  color: #606266;
}

.btn-sm:hover {
  color: #409eff;
  border-color: #c6e2ff;
  background-color: #ecf5ff;
}

.btn-active {
  background-color: #fdf6ec;
  color: #e6a23c;
  border-color: #f5dab1;
}

.btn-xs {
  padding: 4px 8px;
  font-size: 12px;
}

/* Status Indicators */
.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.connected { background-color: #f0f9eb; color: #67c23a; }
.connecting { background-color: #fdf6ec; color: #e6a23c; }
.disconnected, .failed { background-color: #fef0f0; color: #f56c6c; }

/* Documentation Table */
.doc-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-size: 13px;
}

.doc-table th, .doc-table td {
  border: 1px solid #ebeef5;
  padding: 8px 12px;
  text-align: left;
}

.doc-table th {
  background-color: #f5f7fa;
  color: #606266;
  font-weight: 600;
}

.doc-table td code {
  background-color: #f0f2f5;
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
  color: #409eff;
}

/* Responsive */
@media (max-width: 1024px) {
  .main-container {
    grid-template-columns: 1fr;
  }
  
  .sidebar {
    order: 2;
  }
}
</style>
