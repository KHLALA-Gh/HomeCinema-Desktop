import { Socket } from "net";
import { Server } from "http";

console.log("server process initialized");

let server: Server | null;
const sockets = new Set<Socket>();
process.title = "HomeCinema Server";

process.on("message", async (e: any) => {
  const { type, port } = e;

  if (type === "START_SERVER") {
    await createServer(port);
    process.send?.({
      status: "ready",
      url: `http://localhost:${port}`,
    });
  }
  if (type === "SHUTDOWN") {
    console.log(`shutting down server...`);
    destroySockets();
    await shutdownServer();

    process.exit(0);
  }
});

/* ---------------- SERVER ---------------- */

async function createServer(port: number) {
  //@ts-ignore
  const { bootServer } = await import("home-cinema-app-backup");
  server = await bootServer(port, {
    desktopMode: true,
    version: {
      name: "Alpha 7",
      semVer: "0.0.7",
    },
  });
  server?.on("connection", (socket) => {
    sockets.add(socket);
  });
}

async function shutdownServer() {
  if (!server) return;
  server.closeAllConnections();
  server.removeAllListeners();
  return new Promise((resolve) => {
    server?.close(() => {
      console.log("HTTP server closed");
      resolve(0);
    });
  });
}

function destroySockets() {
  for (const socket of sockets) socket.destroy();
  sockets.clear();
  console.log("sockets destroyed");
}
