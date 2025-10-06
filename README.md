# 通用直播视频播放器

一个支持多种视频流协议的通用直播播放器组件，基于 Vue 3 + TypeScript 开发。

## 特性

- 🎥 **多协议支持**: WebRTC、RTMP、RTSP、GB28181、HLS、FLV
- 🎮 **完整控制**: 播放、暂停、停止、刷新、音量控制
- 📸 **截图功能**: 支持自定义格式和质量的视频截图
- 🎞️ **抽帧功能**: 支持定时抽取视频帧并下载
- 📊 **统计信息**: 实时显示播放状态、码率、帧率等信息
- 🎨 **现代UI**: 美观的控制界面，支持全屏播放
- 📱 **响应式**: 适配不同屏幕尺寸

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 使用方法

### 基本用法

```vue
<template>
  <UniversalPlayer
    :config="playerConfig"
    :events="playerEvents"
    :show-controls="true"
    :show-stats="false"
  />
</template>

<script setup>
import UniversalPlayer from '@/components/UniversalPlayer.vue'
import { StreamType } from '@/types'

const playerConfig = {
  url: 'webrtc://localhost:1985/live/livestream',
  type: StreamType.WEBRTC,
  width: 800,
  height: 450,
  autoplay: false,
  muted: false
}

const playerEvents = {
  onPlay: () => console.log('播放开始'),
  onPause: () => console.log('播放暂停'),
  onError: (error) => console.error('播放错误:', error)
}
</script>
```

### 配置选项

#### PlayerConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| url | string | - | 视频流URL |
| type | StreamType | - | 视频流类型 |
| width | number \| string | 800 | 播放器宽度 |
| height | number \| string | 450 | 播放器高度 |
| autoplay | boolean | false | 是否自动播放 |
| muted | boolean | false | 是否静音 |
| poster | string | - | 封面图片URL |

#### StreamType

- `webrtc`: WebRTC 协议
- `rtmp`: RTMP 协议
- `rtsp`: RTSP 协议
- `gb28181`: GB28181 协议
- `hls`: HLS 协议
- `flv`: FLV 协议

### 事件回调

```typescript
interface PlayerEvents {
  onLoadStart?: () => void
  onLoadEnd?: () => void
  onPlay?: () => void
  onPause?: () => void
  onStop?: () => void
  onError?: (error: Error) => void
  onTimeUpdate?: (time: number) => void
  onVolumeChange?: (volume: number) => void
}
```

### 播放器方法

通过 ref 获取播放器实例，调用相应方法：

```vue
<template>
  <UniversalPlayer ref="playerRef" :config="config" />
  <button @click="takeScreenshot">截图</button>
</template>

<script setup>
const playerRef = ref()

const takeScreenshot = async () => {
  const imageUrl = await playerRef.value.screenshot({
    format: 'png',
    quality: 0.92
  })
  console.log('截图URL:', imageUrl)
}
</script>
```

#### 可用方法

- `play()`: 开始播放
- `pause()`: 暂停播放
- `stop()`: 停止播放
- `refresh()`: 刷新播放器
- `setVolume(volume: number)`: 设置音量 (0-1)
- `getVolume()`: 获取当前音量
- `getCurrentTime()`: 获取当前播放时间
- `getDuration()`: 获取视频总时长
- `getStatus()`: 获取播放状态
- `screenshot(config?)`: 截图
- `startFrameExtract(config?)`: 开始抽帧
- `stopFrameExtract()`: 停止抽帧
- `destroy()`: 销毁播放器

### 截图配置

```typescript
interface ScreenshotConfig {
  format?: 'png' | 'jpeg' | 'webp'  // 图片格式
  quality?: number                   // 图片质量 (0-1)
  width?: number                     // 输出宽度
  height?: number                    // 输出高度
}
```

### 抽帧配置

```typescript
interface FrameExtractConfig {
  interval?: number      // 抽帧间隔 (秒)
  maxFrames?: number     // 最大帧数
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number       // 图片质量 (0-1)
}
```

## 支持的视频流格式

### WebRTC
- URL格式: `webrtc://domain:port/app/stream`
- 依赖: SRS SDK

### RTMP
- URL格式: `rtmp://domain:port/app/stream`
- 依赖: jswebrtc

### RTSP
- URL格式: `rtsp://username:password@domain:port/path`
- 依赖: jswebrtc

### GB28181
- URL格式: 根据GB28181协议配置
- 依赖: jswebrtc

### HLS
- URL格式: `https://domain/path/playlist.m3u8`
- 原生支持

### FLV
- URL格式: `https://domain/path/stream.flv`
- 原生支持

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 开发说明

### 项目结构

```
src/
├── components/          # 组件
│   └── UniversalPlayer.vue
├── types/              # 类型定义
│   └── index.ts
├── utils/              # 工具函数
│   └── index.ts
├── views/              # 页面
│   └── Demo.vue
├── router/             # 路由
│   └── index.ts
├── App.vue             # 主应用
└── main.ts             # 入口文件
```

### 添加新的视频流协议

1. 在 `types/index.ts` 中添加新的 `StreamType`
2. 在 `UniversalPlayer.vue` 中的 `play()` 方法添加对应的播放逻辑
3. 如需要，添加相应的第三方库到 `public/vendors/`

## 许可证

MIT License