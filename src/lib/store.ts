import { app } from "electron";
import Store from "electron-store";
import fs from "fs";
import path from "path";

export interface DownloadHistory {
  infoHash: string;
  name: string;
  path: string;
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
    return this.downloadHistory;
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
  changeDownloadDir(newDir: string) {
    if (!fs.existsSync(newDir))
      throw new Error("new directory doesn't exists : " + newDir);
    if (!fs.existsSync(this.downloadDir))
      throw new Error("old directory doesn't exists : " + this.downloadDir);
    fs.cpSync(this.downloadDir, newDir);
    fs.rmSync(this.downloadDir);
    this.set(this.downloadDirKey, newDir);
    this.downloadDir = newDir;
  }
  getDownloadDir() {
    return this.downloadDir;
  }
}
