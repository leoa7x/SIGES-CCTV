import { Inject, Injectable, Optional } from "@nestjs/common";
import { execFile } from "node:child_process";
import net from "node:net";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type ProbeRunnerResult = { code: number; stdout: string; stderr: string };
type ProbeRunner = (ip: string) => Promise<ProbeRunnerResult>;

async function defaultRunner(ip: string): Promise<ProbeRunnerResult> {
  try {
    const { stdout, stderr } = await execFileAsync("ping", ["-c", "1", "-W", "2", ip]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: failure.code ?? 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    };
  }
}

@Injectable()
export class HeartbeatProbeService {
  constructor(
    @Optional()
    @Inject("HEARTBEAT_PROBE_RUNNER")
    private readonly runner: ProbeRunner = defaultRunner,
  ) {}

  async probeIp(ip: string, tcpFallbackPorts: number[] = []) {
    const checkedAt = new Date();
    const result = await this.runner(ip);
    if (result.code !== 0) {
      for (const port of tcpFallbackPorts) {
        if (await this.probeTcp(ip, port)) {
          return { reachable: true, checkedAt, detail: `TCP ${port}` };
        }
      }
    }
    return {
      reachable: result.code === 0,
      checkedAt,
      detail: result.code === 0 ? null : (result.stderr.trim() || result.stdout.trim() || "unreachable"),
    };
  }

  private probeTcp(ip: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.connect({ host: ip, port });
      const finish = (reachable: boolean) => { socket.destroy(); resolve(reachable); };
      socket.setTimeout(1_500);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false));
      socket.once("error", () => finish(false));
    });
  }
}
