import path from 'path'
import { fileURLToPath } from 'url'
import { app, BrowserWindow, ipcMain } from 'electron'
import { initLogger, logMessage, logError } from './logger.js'

// 在app启动前添加命令行参数来禁用Autofill
app.commandLine.appendSwitch('disable-features', 'Autofill')

// 获取当前文件的路径信息
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow
const logFilePath = initLogger()
logMessage('info', '应用启动', { logFilePath })

// 创建窗口函数
function createWindow () {
  logMessage('debug', '开始创建主窗口')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      // 禁用不必要的功能以避免警告
      disableBlinkFeatures: 'Autofill'
    }
  })

  // 根据环境加载不同的URL
  const isDev = process.argv.includes('--dev')
  logMessage('info', '检测到运行模式', { isDev })
  if (isDev) {
    // 开发环境：加载Vite开发服务器
    // 添加重试机制，确保在Vite服务器启动后再连接
    const loadDevServer = () => {
      mainWindow.loadURL('http://localhost:5173').then(() => {
        logMessage('info', '开发服务器加载成功')
      }).catch((err) => {
        logError(err, '无法连接到开发服务器，500ms后重试')
        setTimeout(loadDevServer, 500)
      })
    }
    loadDevServer()
    mainWindow.webContents.openDevTools()
    logMessage('debug', '已打开开发者工具')
  } else {
    // 生产环境：加载打包后的HTML文件
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html')).then(() => {
      logMessage('info', '生产环境页面加载完成')
    }).catch((err) => {
      logError(err, '生产环境页面加载失败')
    })
  }

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    logMessage('info', '主窗口已关闭')
    mainWindow = null
  })
}

// 当Electron应用准备就绪时创建窗口
app.whenReady().then(() => {
  logMessage('info', 'Electron 已准备就绪')
  createWindow()

  // macOS下，当所有窗口关闭后，点击Dock图标会重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      logMessage('info', '重新激活应用，创建新窗口')
      createWindow()
    }
  })
}).catch(err => {
  logError(err, '应用初始化失败')
})

// 当所有窗口关闭时退出应用（除了macOS）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    logMessage('info', '窗口全部关闭，退出应用')
    app.quit()
  }
})

ipcMain.handle('log:message', async (_event, payload) => {
  if (!payload) return false
  const { level = 'info', message = '', meta } = payload
  logMessage(level, message, meta)
  return true
})

process.on('uncaughtException', (error) => {
  logError(error, '未捕获的异常')
})

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(JSON.stringify(reason))
  logError(error, '未处理的 Promise 拒绝')
})