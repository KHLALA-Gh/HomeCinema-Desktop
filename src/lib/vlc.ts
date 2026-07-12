import { openApp } from "open";

export async function openVLC(streams: string[]) {
  await openApp("vlc", { arguments: streams, wait: true });
}
