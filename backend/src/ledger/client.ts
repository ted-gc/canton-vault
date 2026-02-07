import axios, { AxiosInstance } from "axios";
import { randomUUID } from "crypto";

export interface LedgerClientOptions {
  baseUrl?: string;
  accessToken?: string;
}

// Canton JSON API v2 types
export interface CreateCommand {
  create: {
    templateId: string;
    arguments: Record<string, unknown>;
  };
}

export interface ExerciseCommand {
  exercise: {
    templateId: string;
    contractId: string;
    choice: string;
    argument: Record<string, unknown>;
  };
}

export type Command = CreateCommand | ExerciseCommand;

export interface SubmitRequest {
  commands: Command[];
  actAs: string[];
  readAs?: string[];
  commandId?: string;
  workflowId?: string;
}

export interface QueryRequest {
  templateId: string;
  query?: Record<string, unknown>;
}

export interface Contract<T = Record<string, unknown>> {
  contractId: string;
  templateId: string;
  payload: T;
  signatories: string[];
  observers: string[];
  createdAt: string;
}

export interface QueryResponse<T = Record<string, unknown>> {
  result: Contract<T>[];
  offset?: string;
}

export interface SubmitResponse {
  result: {
    completionOffset: string;
    events: unknown[];
  };
}

export class LedgerClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(options: LedgerClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env.LEDGER_API_URL ?? "http://localhost:6201/v2";
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
        ...(options.accessToken || process.env.LEDGER_ACCESS_TOKEN
          ? { Authorization: `Bearer ${options.accessToken ?? process.env.LEDGER_ACCESS_TOKEN}` }
          : {}),
      },
      timeout: 30000,
    });
  }

  // ===== Low-level API =====

  async get<T>(path: string): Promise<T> {
    const res = await this.client.get<T>(path);
    return res.data;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.client.post<T>(path, body);
    return res.data;
  }

  // ===== Contract Queries =====

  /**
   * Query active contracts by template
   */
  async queryContracts<T = Record<string, unknown>>(
    templateId: string,
    query?: Record<string, unknown>,
    parties?: string[]
  ): Promise<Contract<T>[]> {
    const payload: QueryRequest & { readers?: string[] } = { templateId };
    if (query) payload.query = query;
    if (parties) payload.readers = parties;

    try {
      const res = await this.post<QueryResponse<T>>("/query", payload);
      return res.result ?? [];
    } catch (err: any) {
      // Return empty if ledger not available (demo mode)
      if (err.code === "ECONNREFUSED") {
        console.warn("Ledger not available, returning empty query result");
        return [];
      }
      throw err;
    }
  }

  /**
   * Get a specific contract by ID
   */
  async getContract<T = Record<string, unknown>>(contractId: string): Promise<Contract<T> | null> {
    try {
      const res = await this.post<{ result: Contract<T> | null }>("/fetch", { contractId });
      return res.result;
    } catch {
      return null;
    }
  }

  // ===== Command Submission =====

  /**
   * Submit commands to the ledger
   */
  async submit(request: SubmitRequest): Promise<SubmitResponse> {
    const payload = {
      ...request,
      commandId: request.commandId ?? `cmd-${randomUUID()}`,
    };

    const path = process.env.LEDGER_SUBMIT_PATH ?? "/command/submit";
    return this.post<SubmitResponse>(path, payload);
  }

  /**
   * Create a new contract
   */
  async createContract(
    templateId: string,
    arguments_: Record<string, unknown>,
    actAs: string[]
  ): Promise<SubmitResponse> {
    return this.submit({
      commands: [{ create: { templateId, arguments: arguments_ } }],
      actAs,
    });
  }

  /**
   * Exercise a choice on a contract
   */
  async exerciseChoice(
    templateId: string,
    contractId: string,
    choice: string,
    argument: Record<string, unknown>,
    actAs: string[]
  ): Promise<SubmitResponse> {
    return this.submit({
      commands: [{ exercise: { templateId, contractId, choice, argument } }],
      actAs,
    });
  }

  // ===== Convenience Methods =====

  /**
   * List all parties on the ledger
   */
  async listParties(): Promise<unknown> {
    return this.get("/parties");
  }

  /**
   * Check if ledger is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.get("/livez");
      return true;
    } catch {
      return false;
    }
  }
}
