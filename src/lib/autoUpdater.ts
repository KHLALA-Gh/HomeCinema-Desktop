import electronUpdater from "electron-updater";
import log from "electron-log";
import { app } from "electron";
const { autoUpdater } = electronUpdater;
export default class AppUpdater {
  constructor() {
    if (app.isPackaged) {
      this.configure();
      this.check();
    }
  }

  private configure() {
    log.transports.file.level = "debug";
    autoUpdater.logger = log;

    autoUpdater.on("checking-for-update", () => {
      log.info("Checking for updates...");
    });

    autoUpdater.on("update-available", (info) => {
      log.info("Update available:", info.version);
    });

    autoUpdater.on("update-not-available", () => {
      log.info("No updates available");
    });

    autoUpdater.on("error", (err) => {
      log.error("Updater error:", err);
    });

    autoUpdater.on("update-downloaded", () => {
      log.info("Update downloaded, will install on restart");
      // autoUpdater.quitAndInstall(); // optional
    });
  }

  private check() {
    autoUpdater.checkForUpdatesAndNotify();
  }
}
