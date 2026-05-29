import type { InitRequest, InitResponse, RoundResponse, SpinRequest, SpinResponse } from "../../../shared/contracts/api.js";

export class GameApiClient {
  constructor(private readonly baseUrl = "/api") {}

  init(request: InitRequest = {}): Promise<InitResponse> {
    return this.post("/init", request);
  }

  spin(request: SpinRequest): Promise<SpinResponse> {
    return this.post("/spin", request);
  }

  async getRound(roundId: string): Promise<RoundResponse> {
    const response = await fetch(`${this.baseUrl}/round/${encodeURIComponent(roundId)}`);
    if (!response.ok) throw new Error(`API_${response.status}`);
    return response.json() as Promise<RoundResponse>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`API_${response.status}`);
    return response.json() as Promise<T>;
  }
}
