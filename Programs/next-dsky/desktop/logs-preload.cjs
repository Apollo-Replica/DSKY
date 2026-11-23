// Preload for the Logs window: a narrow bridge to the main process's log.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dskyLogs', {
    get: () => ipcRenderer.invoke('logs:get'),
    openFolder: () => ipcRenderer.invoke('logs:open-folder'),
    onLine: (callback) => {
        ipcRenderer.on('logs:line', (_event, line) => callback(line))
    },
})
