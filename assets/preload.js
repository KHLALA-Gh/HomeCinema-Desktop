const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electron", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  openVLC: (streams) => ipcRenderer.invoke("open-vlc", streams),
  openFolder: (path) => ipcRenderer.invoke("open-folder", path),
});
