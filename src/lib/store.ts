import { randomUUID } from "crypto";
import { app } from "electron";
import Store from "electron-store";
import fs from "fs-extra";
import path from "path";

async function moveContentsSafe(srcDir: string, destDir: string) {
  if (path.resolve(srcDir) === path.resolve(destDir)) {
    throw new Error("Source and destination cannot be the same");
  }

  const items = await fs.readdir(srcDir);

  for (const item of items) {
    const srcPath = path.join(srcDir, item);
    if (path.resolve(srcPath) === path.resolve(destDir)) {
      continue;
    }
    let itemName = item;
    if (fs.existsSync(path.join(destDir, item))) {
      itemName += " copy-" + randomUUID();
    }
    await fs.move(path.join(srcDir, item), path.join(destDir, itemName), {
      overwrite: true,
    });
  }
}

export interface DownloadHistory {
  infoHash: string;
  name: string;
  path: string;
  size: number;
  date: number;
}

export interface Movie {
  id: string;
}

export interface TVShow {
  id: string;
}

export interface Torrent {
  infoHash: string;
}

type MovieEntries = [string, Movie][];
type TVShowEntries = [string, TVShow][];
type TorrentsEntries = [string, Torrent][];
type DownloadHistoryEntries = [string, DownloadHistory][];

export class AppStore extends Store {
  private movies: Map<string, Movie> = new Map();
  private tvShows: Map<string, TVShow> = new Map();
  private torrents: Map<string, Torrent> = new Map();
  private downloadHistory: Map<string, DownloadHistory> = new Map();
  private readonly moviesKey = "movies";
  private readonly tvShowKey = "tv-shows";
  private readonly torrentKey = "torrents";
  private readonly downloadHistoryKey = "download-history";
  private readonly downloadDirKey = "download-dir";
  private downloadDir = "";
  private librarySet = false;
  private librarySetKey = "lib-set";
  constructor() {
    super();
    this.reloadCache();
  }

  saveMovie(movie: Movie) {
    this.movies.set(movie.id, movie);
    this.set(this.moviesKey, Array.from(this.movies));
  }
  saveTVShow(tv: TVShow) {
    this.tvShows.set(tv.id, tv);
    this.set(this.tvShowKey, Array.from(this.tvShows) as TVShowEntries);
  }
  saveTorrent(torrent: Torrent) {
    this.torrents.set(torrent.infoHash, torrent);
    this.set(this.torrentKey, Array.from(this.torrents) as TorrentsEntries);
  }
  /**
   * Reload the cache from disk.
   */
  reloadCache(): void {
    const movies = this.get<string>(this.moviesKey, []) as MovieEntries;
    const tvShows = this.get<string>(this.tvShowKey, []) as TVShowEntries;
    const torrents = this.get<string>(this.torrentKey, []) as TorrentsEntries;
    this.librarySet = this.get<string>(this.librarySetKey, false) as boolean;
    this.downloadDir = this.get<string>(
      this.downloadDirKey,
      path.join(app.getPath("videos"), "homecinema"),
    ) as string;
    const downloadHistory = this.get<string>(
      this.downloadHistoryKey,
      [],
    ) as DownloadHistoryEntries;

    this.movies = new Map(movies);
    this.tvShows = new Map(tvShows);
    this.torrents = new Map(torrents);
    this.downloadHistory = new Map(downloadHistory);
  }

  getLibSet(): boolean {
    return this.librarySet;
  }
  setLibSet(set: boolean) {
    this.set(this.librarySetKey, set);
    this.librarySet = set;
  }
  getMovies(): Map<string, Movie> {
    return this.movies;
  }
  getTVShows(): Map<string, TVShow> {
    return this.tvShows;
  }
  getTorrents(): Map<string, Torrent> {
    return this.torrents;
  }
  getMovieByID(id: string): Movie | undefined {
    return this.movies.get(id);
  }
  getTVShowByID(id: string): Movie | undefined {
    return this.tvShows.get(id);
  }
  getTorrentByHash(hash: string): Torrent | undefined {
    return this.torrents.get(hash);
  }
  deleteMovie(id: string) {
    if (this.movies.delete(id))
      this.set(this.moviesKey, Array.from(this.movies) as MovieEntries);
  }
  deleteTVShow(id: string) {
    if (this.tvShows.delete(id))
      this.set(this.tvShowKey, Array.from(this.tvShows) as TVShowEntries);
  }
  deleteTorrent(hash: string) {
    if (this.torrents.delete(hash))
      this.set(this.torrentKey, Array.from(this.torrents) as TorrentsEntries);
  }
  getHistory() {
    return new Map(this.downloadHistory);
  }
  getDownloadHistoryByHash(hash: string) {
    return this.downloadHistory.get(hash.toLowerCase());
  }
  deleteDownloadHistoryByHash(hash: string) {
    if (
      this.downloadHistory.delete(hash) ||
      this.downloadHistory.delete(hash.toLowerCase())
    )
      this.set(this.downloadHistoryKey, Array.from(this.downloadHistory));
  }
  setDownloadHistoryByHash(hash: string, d: DownloadHistory) {
    d.infoHash = d.infoHash.toLowerCase();
    this.downloadHistory.set(hash.toLowerCase(), d);
    this.set(this.downloadHistoryKey, Array.from(this.downloadHistory));
  }
  async changeDownloadDir(newDir: string) {
    if (!fs.existsSync(newDir))
      throw new Error("new directory doesn't exists : " + newDir);
    if (!fs.statSync(newDir).isDirectory())
      throw new Error("new directory is not a directory");

    if (!fs.existsSync(this.downloadDir)) {
      this.downloadDir = newDir;
      this.set(this.downloadDirKey, newDir);
      return;
    }
    await moveContentsSafe(this.downloadDir, newDir);
    const resolvedSrc = path.resolve(this.downloadDir);
    const resolvedDest = path.resolve(newDir);

    if (!resolvedDest.startsWith(resolvedSrc)) {
      fs.removeSync(this.downloadDir);
    }
    this.set(this.downloadDirKey, newDir);
    this.downloadDir = newDir;
    let torrents = this.getHistory();
    torrents.forEach((t, hash) => {
      torrents.set(hash, {
        ...t,
        path: newDir,
      });
    });
    this.downloadHistory = torrents;
    this.set(this.downloadHistoryKey, Array.from(torrents));
  }
  getDownloadDir() {
    return this.downloadDir;
  }
  deleteDownloadWithPath(p: string): DownloadHistory | undefined {
    let d: DownloadHistory | undefined = undefined;
    this.downloadHistory.forEach((t, hash) => {
      if (path.resolve(p) === path.resolve(path.join(t.path, t.name))) {
        this.downloadHistory.delete(hash);
        this.set(this.downloadHistoryKey, Array.from(this.downloadHistory));
        d = t;
      }
    });
    return d;
  }
}
