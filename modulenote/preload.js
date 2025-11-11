// 这个文件用于在渲染进程和主进程之间提供接口
const { contextBridge, ipcRenderer } = require('electron')

// 暴露到渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 可以在这里添加一些Electron特有的API
  // 例如文件系统操作、系统对话框等
  // 后续可以根据需要扩展这个API
  log: (level, message, meta) => {
    ipcRenderer.invoke('log:message', { level, message, meta })
  }
})