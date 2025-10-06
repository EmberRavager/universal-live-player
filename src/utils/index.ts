import { StreamType } from '@/types'

/**
 * 检测视频流类型
 */
export function detectStreamType(url: string): StreamType {
  const lowerUrl = url.toLowerCase()
  
  if (lowerUrl.startsWith('webrtc://') || lowerUrl.includes('webrtc')) {
    return StreamType.WEBRTC
  }
  if (lowerUrl.startsWith('rtmp://')) {
    return StreamType.RTMP
  }
  if (lowerUrl.startsWith('rtsp://')) {
    return StreamType.RTSP
  }
  if (lowerUrl.includes('.m3u8')) {
    return StreamType.HLS
  }
  if (lowerUrl.includes('.flv')) {
    return StreamType.FLV
  }
  if (lowerUrl.includes('gb28181')) {
    return StreamType.GB28181
  }
  
  // 默认返回WebRTC
  return StreamType.WEBRTC
}

/**
 * 格式化时间
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

/**
 * 下载文件
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Canvas转Blob
 */
export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Canvas to blob conversion failed'))
      }
    }, type, quality)
  })
}

/**
 * 获取视频帧
 */
export function captureVideoFrame(video: HTMLVideoElement, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const targetCanvas = canvas || document.createElement('canvas')
  const ctx = targetCanvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Cannot get canvas context')
  }
  
  targetCanvas.width = video.videoWidth || video.clientWidth
  targetCanvas.height = video.videoHeight || video.clientHeight
  
  ctx.drawImage(video, 0, 0, targetCanvas.width, targetCanvas.height)
  
  return targetCanvas
}

/**
 * 检查浏览器支持
 */
export function checkBrowserSupport(): {
  webrtc: boolean
  mediaSource: boolean
  canvas: boolean
} {
  return {
    webrtc: !!(window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection),
    mediaSource: !!window.MediaSource,
    canvas: !!document.createElement('canvas').getContext
  }
}

/**
 * 加载外部脚本
 */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}