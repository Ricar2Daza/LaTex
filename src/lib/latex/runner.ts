import { spawn } from "node:child_process";

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  error?: string;
}

interface RunOptions {
  cwd: string;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
  maxOutputBytes?: number;
}

const DEFAULT_TIMEOUT = 120_000;
const MAX_OUTPUT = 256 * 1024;

/**
 * Ejecuta un binario sin shell (args como array => sin inyección de comandos),
 * con límite de tiempo, entorno controlado y salida acotada.
 */
export function runProcess(command: string, args: string[], options: RunOptions): Promise<RunResult> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxOutput = options.maxOutputBytes ?? MAX_OUTPUT;

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      shell: false,
      env: {
        ...process.env,
        // Evita que las herramientas intenten abrir paginadores o pedir input.
        PAGER: "cat",
        GIT_PAGER: "cat",
        CI: "1",
        ...options.env,
      },
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    const finish = (result: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdout.length < maxOutput) stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < maxOutput) stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      finish({
        code: null,
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - startedAt,
        error: err.message,
      });
    });

    child.on("close", (code) => {
      finish({
        code,
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}
