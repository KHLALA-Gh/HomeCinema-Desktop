import { dialog, ipcMain, shell } from "electron";
import { openVLC } from "./vlc.js";
import { AppStore, DownloadHistory, Movie, Torrent, TVShow } from "./store.js";
import fs from "fs";
import path from "path";
import axios, { AxiosError } from "axios";
import getFolderSize from "get-folder-size";
import os from "os";
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
      foldersSet.delete(t.name);
    });
    let i = 0;
    foldersSet.forEach((f) => {
      torrents.set(`unknown:${i}`, {
        infoHash: `unknown:${i}`,
        name: f,
        path: dirPath,
        size: 0,
        date: 0,
      });
      i++;
    });
    return torrents;
  });
  ipcMain.handle("dh:set", (e, hash: string, d: DownloadHistory) => {
    return store.setDownloadHistoryByHash(hash, d);
  });
  ipcMain.handle("dh:delete", async (e, path: string) => {
    let history = store.deleteDownloadWithPath(path);
    if (fs.existsSync(path)) {
      fs.rmSync(path, { recursive: true });
    } else {
      throw new Error("torrent path does not exist");
    }
    // TODO : change it with something more dynamic
    if (history) {
      try {
        await axios.delete(
          `http://localhost:5173/api/downloads/${history.infoHash}`,
        );
      } catch (err: any) {
        if (err.status !== 404) {
          throw new Error(
            "unexpected error while deleting torrent from the streamer",
          );
        }
      }
    }
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
  ipcMain.handle(
    "dh:torrent-prop",
    async (_, infoHash): Promise<TorrentProps | null> => {
      let torrent = store.getDownloadHistoryByHash(infoHash);
      if (!torrent) return null;
      let folderPath = path.join(torrent.path, torrent.name);
      let res = await getFolderSize(folderPath);
      return {
        name: torrent.name,
        infoHash: torrent.infoHash,
        path: folderPath,
        date: torrent.date,
        size: torrent.size,
        downloadedSize: res.size,
      };
    },
  );
  ipcMain.handle("dh:set-lib-set", (_, set: boolean) => {
    store.setLibSet(set);
  });
  ipcMain.handle("dh:get-lib-set", (_): boolean => {
    return store.getLibSet();
  });
  ipcMain.handle("filesystem:move", (_, src: string, dest: string) => {
    if (!fs.existsSync(src)) throw new Error("source does not exist");
    fs.cpSync(src, dest, { recursive: true });
    fs.rmSync(src, { recursive: true });
  });
  ipcMain.handle("search:get-option", (_) => {
    return store.getSearchOp();
  });
  ipcMain.handle(
    "search:set-option",
    (_, set: "torrentio" | "torrent-agent") => {
      store.setSearchOp(set);
    },
  );
  ipcMain.handle("get-private-ip", (): string => {
    const interfaces = os.networkInterfaces();

    for (const interfaceName of Object.keys(interfaces)) {
      if (!interfaces[interfaceName]) continue;
      for (const iface of interfaces[interfaceName]) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
    throw Error("cannot get private ip address");
  });
}

interface TorrentProps {
  name: string;
  infoHash: string;
  date: number;
  size: number;
  downloadedSize: number;
  path: string;
}
