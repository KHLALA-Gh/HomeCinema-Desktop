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
  setLibSet: async (set) => await ipcRenderer.invoke("dh:set-lib-set", set),
  setSearchOp: async (set) =>
    await ipcRenderer.invoke("search:set-option", set),
  getLibSet: async () => await ipcRenderer.invoke("dh:get-lib-set"),
  getSearchOp: async () => await ipcRenderer.invoke("search:get-option"),

  deleteSavedTorrent: (hash) =>
    ipcRenderer.invoke("delete-saved-torrent", hash),
  getDH: async (hash) => await ipcRenderer.invoke("dh:get", hash),
  setDH: (hash, d) => ipcRenderer.invoke("dh:set", hash, d),
  deleteDH: (hash) => ipcRenderer.invoke("dh:delete", hash),
  getAllDH: async () => await ipcRenderer.invoke("dh:get-all"),
  getDHPath: async () => await ipcRenderer.invoke("dh:path"),
  changeDHDir: async (newDir) =>
    await ipcRenderer.invoke("dh:change-dir", newDir),
  getTorrentProps: async (infoHash) =>
    await ipcRenderer.invoke("dh:torrent-prop", infoHash),
  move: async (src, dest) =>
    await ipcRenderer.invoke("filesystem:move", src, dest),
  fetchPrivateIp: async () => await ipcRenderer.invoke("get-private-ip"),
});
