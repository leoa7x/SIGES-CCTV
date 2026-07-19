import { Inject, Injectable, Optional } from "@nestjs/common";
import { execFile } from "node:child_process";
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

  async probeIp(ip: string) {
    const checkedAt = new Date();
    const result = await this.runner(ip);
    return {
      reachable: result.code === 0,
      checkedAt,
      detail: result.code === 0 ? null : (result.stderr.trim() || result.stdout.trim() || "unreachable"),
    };
  }
}
