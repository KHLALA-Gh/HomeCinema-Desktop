import { openApp } from "open";

export function openVLC(streams: string[]) {
  openApp("vlc", { arguments: streams });
}
