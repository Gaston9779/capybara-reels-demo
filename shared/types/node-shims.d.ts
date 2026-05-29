declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
};

declare const Buffer: {
  from(input: unknown): unknown;
  concat(chunks: unknown[]): { toString(encoding: string): string };
};

declare module "node:http" {
  export interface IncomingMessage {
    url?: string;
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    [Symbol.asyncIterator](): AsyncIterableIterator<unknown>;
  }

  export interface ServerResponse {
    writeHead(status: number, headers: Record<string, string>): void;
    end(body?: string): void;
  }

  export function createServer(
    handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
  ): { listen(port: number, callback?: () => void): void };
}

declare module "node:assert" {
  export const strict: {
    deepEqual(actual: unknown, expected: unknown): void;
    equal(actual: unknown, expected: unknown): void;
    ok(value: unknown): void;
    throws(fn: () => unknown, expected?: RegExp): void;
  };
}
