const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electron", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  openVLC: (streams) => ipcRenderer.invoke("open-vlc", streams),
  openFolder: (path) => ipcRenderer.invoke("open-folder", path),
  saveMovie: (movie) => ipcRenderer.invoke("save-movie", movie),

  getSavedMovies: () => ipcRenderer.invoke("get-saved-movies"),

  getSavedMovie: (id) => ipcRenderer.invoke("get-saved-movie", id),

  deleteSavedMovie: (id) => ipcRenderer.invoke("delete-saved-movie", id),

  saveShow: (tv) => ipcRenderer.invoke("save-show", tv),

  getSavedShows: () => ipcRenderer.invoke("get-saved-shows"),

  getSavedShow: (id) => ipcRenderer.invoke("get-saved-show", id),

  deleteSavedShow: (id) => ipcRenderer.invoke("delete-saved-show", id),

  saveTorrent: (torrent) => ipcRenderer.invoke("save-torrent", torrent),

  getSavedTorrents: () => ipcRenderer.invoke("get-saved-torrents"),

  getSavedTorrent: (hash) => ipcRenderer.invoke("get-saved-torrent", hash),

  deleteSavedTorrent: (hash) =>
    ipcRenderer.invoke("delete-saved-torrent", hash),
  getDH: (hash) => ipcRenderer.invoke("dh:get", hash),
  setDH: (hash, d) => ipcRenderer.invoke("dh:set", hash, d),
  deleteDH: (hash) => ipcRenderer.invoke("dh:delete", hash),
  getAllDH: async () => await ipcRenderer.invoke("dh:get-all"),
  getDHPath: async () => await ipcRenderer.invoke("dh:path"),
});
