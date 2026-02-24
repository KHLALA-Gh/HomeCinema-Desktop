import { dialog, ipcMain, shell } from "electron";
import { openVLC } from "./vlc.js";
import { AppStore, DownloadHistory, Movie, Torrent, TVShow } from "./store.js";
import fs from "fs";
import path from "path";
import axios from "axios";

export function initIpcHandlers(store: AppStore) {
  ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("dh:path", (_) => {
    return store.getDownloadDir();
  });
  ipcMain.handle("open-folder", async (e, path: string) => {
    const err = await shell.openPath(path);

    if (err) throw err;
  });
  ipcMain.handle("open-vlc", async (e, streams: string[]) => {
    await openVLC(streams);
  });
  ipcMain.handle("save-movie", (e, movie: Movie) => {
    store.saveMovie(movie);
  });
  ipcMain.handle("get-saved-movies", (e) => {
    return store.getMovies();
  });
  ipcMain.handle("get-saved-movie", (e, id: string) => {
    return store.getMovieByID(id);
  });
  ipcMain.handle("save-show", (e, tv: TVShow) => {
    store.saveTVShow(tv);
  });
  ipcMain.handle("get-saved-shows", (e) => {
    return store.getTVShows();
  });
  ipcMain.handle("get-saved-show", (e, id: string) => {
    return store.getTVShowByID(id);
  });
  ipcMain.handle("delete-saved-show", (e, id: string) => {
    return store.deleteTVShow(id);
  });
  ipcMain.handle("delete-saved-movie", (e, id: string) => {
    return store.deleteMovie(id);
  });
  ipcMain.handle("save-torrent", (e, torrent: Torrent) => {
    store.saveTorrent(torrent);
  });
  ipcMain.handle("get-saved-torrents", (e) => {
    return store.getTorrents();
  });
  ipcMain.handle("get-saved-torrent", (e, hash: string) => {
    return store.getTorrentByHash(hash);
  });
  ipcMain.handle("delete-saved-torrent", (e, hash: string) => {
    return store.deleteTorrent(hash);
  });
  ipcMain.handle("dh:get", (e, hash: string) => {
    return store.getDownloadHistoryByHash(hash);
  });
  ipcMain.handle("dh:get-all", (e) => {
    let torrents = store.getHistory();
    let dirPath = store.getDownloadDir();
    let folders = fs.readdirSync(dirPath);
    folders = folders.filter((f) => {
      const fullPath = path.join(dirPath, f);
      return fs.statSync(fullPath).isDirectory();
    });
    const foldersSet = new Set(folders);
    torrents.forEach((t) => {
      if (!foldersSet.has(t.name)) {
        store.deleteDownloadHistoryByHash(t.infoHash);
      } else {
        let p = path.join(t.path, t.name);
        let p2 = path.join(dirPath, t.name);
        if (
          path.normalize(path.resolve(p)) !== path.normalize(path.resolve(p2))
        ) {
          store.deleteDownloadHistoryByHash(t.infoHash);
        }
      }
      foldersSet.delete(t.name);
    });
    let i = 0;
    console.log(foldersSet);
    foldersSet.forEach((f) => {
      torrents.set(`unknown:${i}`, {
        infoHash: `unknown:${i}`,
        name: f,
        path: dirPath,
      });
      i++;
    });
    return torrents;
  });
  ipcMain.handle("dh:set", (e, hash: string, d: DownloadHistory) => {
    return store.setDownloadHistoryByHash(hash, d);
  });
  // TODO : Change to delete with path.
  ipcMain.handle("dh:delete", async (e, hash: string) => {
    let t = store.getDownloadHistoryByHash(hash);
    if (!t) return;
    store.deleteDownloadHistoryByHash(hash);
    let p = path.join(t.path, t.name || "undefined");
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true });
    }
    // TODO : change it with something more dynamic
    await axios.delete(`http://localhost:5173/api/downloads/${hash}`);
  });
  ipcMain.handle("dh:change-dir", async (_, newDir) => {
    try {
      await store.changeDownloadDir(newDir);
    } catch (err: any) {
      let msg = "unknown error";
      if (typeof err.message === "string") {
        msg = err.message;
      }
      dialog.showErrorBox("Cannot change library folder", msg);
      throw err;
    }
  });
}
