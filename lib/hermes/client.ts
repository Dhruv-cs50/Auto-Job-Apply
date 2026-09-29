export type HermesRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type HermesRun = {
  run_id: string;
  status: HermesRunStatus;
  output?: unknown;
  error?: unknown;
  usage?: unknown;
  runtime?: unknown;
};

export type CreateHermesRunInput = {
  input: string;
  instructions?: string;
  sessionId?: string;
  idempotencyKey: string;
};

export type HermesClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export class HermesClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HermesClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getCapabilities(): Promise<unknown> {
    return this.request("/v1/capabilities", { method: "GET" });
  }

  createRun(input: CreateHermesRunInput): Promise<HermesRun> {
    return this.request("/v1/runs", {
      method: "POST",
      headers: { "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({
        input: input.input,
        instructions: input.instructions,
        session_id: input.sessionId,
      }),
    });
  }

  getRun(runId: string): Promise<HermesRun> {
    return this.request(`/v1/runs/${encodeURIComponent(runId)}`, { method: "GET" });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Hermes API ${response.status}: ${details.slice(0, 500)}`);
    }

    return response.json() as Promise<T>;
  }
}
