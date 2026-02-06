import { dialog, ipcMain, shell } from "electron";
import { openVLC } from "./vlc.js";
import { AppStore, Movie, Torrent, TVShow } from "./store.js";

export function initIpcHandlers(store: AppStore) {
  ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("open-folder", async (e, path: string) => {
    const err = await shell.openPath(path);

    if (err) throw err;
  });
  ipcMain.handle("open-vlc", (e, streams: string[]) => {
    openVLC(streams);
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
}
