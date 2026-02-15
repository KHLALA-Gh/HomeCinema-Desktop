import axios from "axios";
import Store from "electron-store";
export interface FetchDownloadsOpts {
  ignoreComplete: boolean;
}
export async function fetchDownloads(
  port: number,
  store: Store,
  opts?: Partial<FetchDownloadsOpts>,
) {
  const resp = await axios.get(`http://localhost:${port}/api/downloads`, {
    timeout: 5 * 1000,
  });
  if (resp.status === 200) {
    if (opts?.ignoreComplete && resp.data instanceof Array) {
      resp.data = resp.data.filter((d) => !d.isComplete);
    }
    store.set("downloads", resp.data);
  }
}
