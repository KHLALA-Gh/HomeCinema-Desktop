import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  dialog,
  Notification,
} from "electron";
import path from "node:path";
import getPort from "get-port";
import { fileURLToPath } from "node:url";
import env from "dotenv";
import { ChildProcess, fork } from "node:child_process";
import Store from "electron-store";
import axios, { AxiosError } from "axios";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null;
let port: number;
let serverCleanedUp = false;
let getTheLock = app.requestSingleInstanceLock();
const store = new Store();

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

  await shutdownServer();
  tray?.destroy();
  tray = null;
  app.quit();
}

env.config({
  path: path.join(app.getAppPath(), ".env"),
});

/* ---------------- SERVER ---------------- */

async function createServer(port: number) {
  const serverFilePath = path.join(app.getAppPath(), "dist/server.js");
  serverProcess = fork(path.join(serverFilePath), [], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
  serverCleanedUp = false;
  if (!serverProcess) return false;

  serverProcess.send({ type: "START_SERVER", port });
  if (serverProcess.stdout) {
    serverProcess.stdout.on("", (data) => {
      process.stdout.write(`[Server]: ${data}`);
    });

    serverProcess.on("exit", (code) => {
      console.log(`[Server]: server process exited with code ${code}`);
      cleanupServerProcess(serverProcess);
    });
  }
  return new Promise<boolean>((res) => {
    if (!serverProcess) return res(false);
    serverProcess.once("message", (msg) => {
      //@ts-ignore
      if (msg.status === "ready") {
        return res(true);
      }
      res(false);
    });
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
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist/preload.js"),
    },
  });

  await mainWindow.loadURL(`http://localhost:${port}`);

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
          port = await getPort();
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

  ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    return result.canceled ? null : result.filePaths[0];
  });
  app.whenReady().then(async () => {
    try {
      createTray();
      port = await getPort();
      // await createServer(port);
      await createWindow(5173);
      await setSavedTorrents();
      mainWindow?.once("ready-to-show", () => {
        createTray();
      });
    } catch (err) {
      if (err instanceof AxiosError) {
        dialog.showErrorBox("Error when booting app", err.message);
      } else {
        dialog.showErrorBox("Error when closing app", "unknown error");
      }
      console.error(err);
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
    e.preventDefault();
    const resp = await axios.get(`http://localhost:8081/api/downloads`, {
      timeout: 5 * 1000,
    });
    if (resp.status === 200) {
      console.log(resp.data);
      store.set("downloads", resp.data);
    }
    app.exit(0);
  } catch (err: any) {
    if (err instanceof AxiosError) {
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
  const downloads = store.get("downloads", []) as [];
  if (!downloads.length) return;
  new Notification({
    title: "HomeCinema",
    body: "Setting saved downloads...",
  }).show();
  const resp = await axios.post(`http://localhost:8081/api/downloads`, {
    downloads,
  });
  new Notification({
    title: "HomeCinema",
    body: `${resp.data.setCount} torrents are setted`,
  }).show();
}
