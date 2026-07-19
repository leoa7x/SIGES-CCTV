import { existsSync } from "node:fs";

const HOST_SCRIPT_PATH = /\/home\/[^/\s]+\/SIGES-CCTV\/apps\/api\/scripts\/([^\s]+)/;

export function normalizeDiscoveryCommandTemplate(
  commandTemplate: string,
  fileExists: (path: string) => boolean = existsSync,
) {
  const match = commandTemplate.match(HOST_SCRIPT_PATH);
  if (!match) return commandTemplate;

  const hostScriptPath = match[0];
  if (fileExists(hostScriptPath)) return commandTemplate;

  const containerScriptPath = `/app/apps/api/scripts/${match[1]}`;
  if (!fileExists(containerScriptPath)) return commandTemplate;

  return commandTemplate.replace(hostScriptPath, containerScriptPath);
}
