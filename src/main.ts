console.log(`${getTime()} : Starting...`);
import { app, BrowserWindow, Tray, Menu, dialog, Notification } from "electron";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import type { Axios } from "axios";
import { fetchDownloads } from "./lib/streamer.js";
import type { AppStore } from "./lib/store.js";
import type AppUpdater from "./lib/autoUpdater.js";
let appUpdater: AppUpdater;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null;
let port: number;
let serverCleanedUp = false;
let downloadFetchInterval: NodeJS.Timeout;
let getTheLock = app.requestSingleInstanceLock();
let axios: Axios;
let store: AppStore;
let torrentSet = false;
console.log(`${getTime()} : Modules imported`);

function getTime() {
  return new Date().toLocaleTimeString(undefined, { hour12: false });
}

function cleanupServerProcess(proc: ChildProcess | null) {
  if (!proc || serverCleanedUp) return;
  serverCleanedUp = true;

  proc.removeAllListeners();
  proc.stdout?.removeAllListeners();
  proc.stderr?.removeAllListeners();

  serverProcess = null;
  console.log("[Server]: cleaned up");
}

async function quitApp() {
  //@ts-ignore
  app.isQuiting = true;

  if (mainWindow) {
    mainWindow.removeAllListeners("close");
    mainWindow.close();
    mainWindow = null;
  }

  tray?.destroy();
  tray = null;
  app.quit();
}

/* ---------------- SERVER ---------------- */

async function createServer(port: number) {
  const serverFilePath = path.join(app.getAppPath(), "dist/server.js");
  const { fork } = await import("node:child_process");
  serverProcess = fork(serverFilePath, [], {
    stdio: "ignore",
    env: { ...process.env, NODE_ENV: "production" },
  });

  serverCleanedUp = false;

  return new Promise<void>((res, rej) => {
    if (!serverProcess) throw new Error("No server process");

    let resolved = false;

    const t = setTimeout(() => {
      resolved = true;
      rej(new Error("TIMEOUT: Server didn't respond with ready status"));
    }, 20_000);

    const exitFn = (code: number | null) => {
      console.log(`[Server]: server process exited with code ${code}`);
      cleanupServerProcess(serverProcess);
      if (!resolved) {
        resolved = true;
        clearTimeout(t);
        rej(new Error("server exited"));
      }
    };

    const messageFn = (msg: any) => {
      if (msg?.status === "ready" && !resolved) {
        resolved = true;
        clearTimeout(t);
        serverProcess?.removeListener("exit", exitFn);
        serverProcess?.removeListener("message", messageFn);
        res();
      }
    };

    serverProcess.on("exit", exitFn);
    serverProcess.on("message", messageFn);

    serverProcess.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(t);
        rej(err);
      }
    });

    let sent = serverProcess.send({ type: "START_SERVER", port });
    if (sent) {
      console.log("waiting for server to respond");
    } else {
      resolved = true;
      cleanupServerProcess(serverProcess);
      rej(new Error("cannot send START_SERVER signal"));
    }
  });
}

/* ---------------- WINDOW ---------------- */

async function createWindow(port: number, reload?: boolean) {
  if (mainWindow) {
    mainWindow.show();
    if (reload) {
      await mainWindow.loadURL(`http://localhost:${port}`);
    }
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), "assets/preload.js"),
    },
  });
  // Hide instead of close
  mainWindow.on("close", (event) => {
    //@ts-ignore

    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  try {
    const file = path.join(app.getAppPath(), "assets/loading.html");
    await mainWindow.loadFile(file);
  } catch (err: any) {
    dialog.showErrorBox("Error when loading page", err.code);
  }
}

/* ---------------- TRAY ---------------- */

function createTray() {
  if (tray) return;
  const iconPath = path.join(app.getAppPath(), "assets", "icon.png");
  tray = new Tray(path.join(iconPath));

  const menu = Menu.buildFromTemplate([
    {
      label: "Open Home Cinema",
      click: async () => {
        //@ts-ignore
        app.isQuiting = false;
        let reload = !serverProcess;
        if (!serverProcess) {
          await loadModules();
          console.log("recreating the server process");
          await createServer(port);
        }
        await createWindow(port, reload);
      },
    },
    {
      label: "Quit",
      click: quitApp,
    },
  ]);

  tray.setToolTip("Home Cinema");
  tray.setContextMenu(menu);

  // Click tray icon to open window
  tray.on("click", () => {
    createWindow(port);
  });
}

/* ---------------- APP LIFECYCLE ---------------- */

if (!getTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      console.log(`${getTime()} : App is ready`);
      console.log(`${getTime()} : Creating window...`);

      await createWindow(port);
      createTray();
      console.log(`${getTime()} : Loading modules...`);

      await loadModules();
      console.log(`${getTime()} : Creating server...`);

      await createServer(port);
      console.log(`${getTime()} : loading window url...`);
      const currentVersion = app.getVersion();
      const lastVersion = store.get("lastVersion");
      let url: string;
      //     if (lastVersion && lastVersion == currentVersion) {
      //     url = `http://localhost:${port}/new-update`;
      // } else {
      // url = `http://localhost:${port}`;
      // }
      store.set("lastVersion", currentVersion);
      url = `http://localhost:${port}`;
      setTimeout(() => {
        if (mainWindow) mainWindow.loadURL(url);
      }, 2000);
      console.log(`${getTime()} : sending torrents...`);

      await setSavedTorrents();
      console.log(`${getTime()} : successfully booted`);
    } catch (err: any) {
      if (err instanceof Error) {
        dialog.showErrorBox("Error when booting app", err.message);
      } else {
        dialog.showErrorBox("Error when booting app", "unknown error");
      }
      console.error(err?.message);
    }
  });
}

async function shutdownServer() {
  if (!serverProcess) return;

  const proc = serverProcess;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.warn("[Server]: force killing server process");
      proc.kill(); // SIGKILL
      resolve();
    }, 3000);

    proc.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    proc.send({ type: "SHUTDOWN" });
  }).finally(() => {
    proc.removeAllListeners();
    proc.stdout?.removeAllListeners();
    proc.stderr?.removeAllListeners();
    serverProcess = null;
  });
  cleanupServerProcess(proc);
}

// Do NOTHING here → keep server running
app.on("window-all-closed", () => {});

// macOS / Linux re-activate
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(port);
  }
});

app.on("before-quit", async (e) => {
  try {
    if (downloadFetchInterval) clearInterval(downloadFetchInterval);
    if (!torrentSet) return app.exit(0);
    e.preventDefault();
    await fetchDownloads(port, store, { ignoreComplete: true });
    await shutdownServer();
    app.exit(0);
  } catch (err: any) {
    console.log(err);
    if (err instanceof Error) {
      dialog.showErrorBox(
        "Error when closing app",
        "cannot save torrents data correctly\n" + err.message,
      );
    } else {
      dialog.showErrorBox(
        "Error when closing app",
        "cannot save torrents data correctly",
      );
    }
    app.exit(0);
  }
});

async function setSavedTorrents() {
  downloadFetchInterval = setInterval(async () => {
    await fetchDownloads(port, store);
    torrentSet = true;
  }, 30_000);
  const downloads = store.get("downloads", []) as [];
  if (!downloads.length) {
    torrentSet = true;
    return;
  }
  new Notification({
    title: "HomeCinema",
    body: "Setting saved downloads...",
  }).show();
  const resp = await axios.post(`http://localhost:${port}/api/downloads`, {
    downloads,
  });
  if (resp.status === 200) {
    torrentSet = true;
  }
  new Notification({
    title: "HomeCinema",
    body: `${resp.data.setCount} torrents are setted`,
  }).show();
}

async function loadModules() {
  const AppUpdater = (await import("./lib/autoUpdater.js")).default;
  appUpdater = new AppUpdater();
  const { AppStore } = await import("./lib/store.js");
  store = new AppStore();
  const { initIpcHandlers } = await import("./lib/ipc.js");
  initIpcHandlers(store);
  const env = (await import("dotenv")).default;
  env.config({
    path: path.join(app.getAppPath(), ".env"),
  });
  let getPort = (await import("get-port")).default;
  port = await getPort();
  axios = (await import("axios")).default;
}
