import { exec } from "node:child_process";

export function openVLC(streams: string[]) {
  exec(`vlc ${streams.join(" ")}`);
}
