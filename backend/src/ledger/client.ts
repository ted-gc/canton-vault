import axios, { AxiosInstance } from "axios";

export interface LedgerClientOptions {
  baseUrl?: string;
  accessToken?: string;
}

export class LedgerClient {
  private client: AxiosInstance;

  constructor(options: LedgerClientOptions = {}) {
    const baseUrl = options.baseUrl ?? process.env.LEDGER_API_URL ?? "http://localhost:6201/v2";
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        "Content-Type": "application/json",
        ...(options.accessToken || process.env.LEDGER_ACCESS_TOKEN
          ? { Authorization: `Bearer ${options.accessToken ?? process.env.LEDGER_ACCESS_TOKEN}` }
          : {}),
      },
      timeout: 10000,
    });
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.client.get<T>(path);
    return res.data;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.client.post<T>(path, body);
    return res.data;
  }

  // Common Canton JSON Ledger API helpers
  async listParties(): Promise<unknown> {
    return this.get("/parties");
  }

  async queryContracts(payload: unknown): Promise<unknown> {
    return this.post("/query", payload);
  }

  async submitCommand(payload: unknown): Promise<unknown> {
    // Endpoint path may vary by Canton version; keep configurable if needed.
    const path = process.env.LEDGER_SUBMIT_PATH ?? "/command/submit";
    return this.post(path, payload);
  }
}
