import axios from "axios";
import Store from "electron-store";
export async function fetchDownloads(port: number, store: Store) {
  const resp = await axios.get(`http://localhost:${port}/api/downloads`, {
    timeout: 5 * 1000,
  });
  if (resp.status === 200) {
    store.set("downloads", resp.data);
  }
}
