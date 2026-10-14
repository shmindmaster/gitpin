import { createServer as createNodeServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getCatalog } from './wiki';
import { createServer as createMcpServer } from './server';

const MAX_MCP_REQUEST_BYTES = 1_048_576;
const DEFAULT_HOST = '127.0.0.1';
const LOOPBACK_HOSTNAMES = new Set(['localhost', '::1', '[::1]']);

interface HttpServerOptions {
  token: string;
  allowedHosts?: string[];
  allowedOrigins?: string[];
}

export interface HttpConfig {
  host: string;
  port: number;
  token: string;
  allowedHosts: string[];
  allowedOrigins: string[];
}

export function createHttpServer(options: HttpServerOptions): Server {
  if (!options.token) throw new Error('GITPIN_MCP_TOKEN (or REPOCONTEXT_MCP_TOKEN) is required for the HTTP server.');
  const allowedHosts = new Set((options.allowedHosts ?? []).map((host) => host.toLowerCase()));
  const allowedOrigins = new Set((options.allowedOrigins ?? []).map(normalizeOrigin));

  return createNodeServer(async (request, response) => {
    setSecurityHeaders(response);
    const url = new URL(request.url ?? '/', 'http://localhost');
    const healthRequest = url.pathname === '/healthz' && (request.method === 'GET' || request.method === 'HEAD');
    if (healthRequest) {
      try {
        const catalog = await getCatalog();
        const unavailable = catalog.filter((repository) => repository.status === 'unavailable');
        if (unavailable.length > 0) {
          throw new Error(
            `Unavailable registry entries: ${unavailable.map((repository) => repository.name).join(', ')}`,
          );
        }
        const documents = catalog.reduce((total, repository) => total + repository.docCount, 0);
        if (documents === 0) throw new Error('No documentation was indexed from the configured registry.');
        sendJson(
          response,
          200,
          {
            service: 'gitpin',
            status: 'ready',
            repositories: catalog.length,
            documents,
          },
          request.method === 'HEAD',
        );
      } catch (error) {
        sendJson(response, 503, {
          service: 'gitpin',
          status: 'not_ready',
          error: error instanceof Error ? error.message : 'Registry unavailable.',
        });
      }
      return;
    }

    // Browsers always send Origin on cross-origin and POST requests, including
    // DNS-rebinding attempts; non-browser MCP clients omit it.
    if (!originAllowed(request, allowedOrigins)) {
      sendJson(response, 403, { error: 'forbidden_origin' });
      return;
    }

    // Managed platforms commonly issue health probes with an internal Host
    // header. Health carries no repository content; MCP calls remain bound to
    // the configured public host.
    if (!hostAllowed(request, allowedHosts)) {
      sendJson(response, 421, { error: 'misdirected_request' });
      return;
    }

    if (url.pathname !== '/api/mcp') {
      sendJson(response, 404, { error: 'not_found' });
      return;
    }

    if (request.method !== 'POST') {
      response.setHeader('allow', 'POST');
      sendJson(response, 405, { error: 'method_not_allowed' });
      return;
    }

    const contentLength = requestContentLength(request);
    if (contentLength === undefined) {
      sendJson(response, 411, { error: 'content_length_required' });
      return;
    }
    if (contentLength === null) {
      sendJson(response, 400, { error: 'invalid_content_length' });
      return;
    }
    if (contentLength > MAX_MCP_REQUEST_BYTES) {
      sendJson(response, 413, { error: 'request_too_large' });
      return;
    }

    if (!authorized(request, options.token)) {
      response.setHeader('www-authenticate', 'Bearer realm="gitpin"');
      sendJson(response, 401, { error: 'invalid_token' });
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const mcp = createMcpServer();
    response.once('finish', () => {
      void mcp.close();
    });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(request, response);
    } catch (error) {
      if (!response.headersSent) {
        sendJson(response, 500, {
          error: 'mcp_request_failed',
          message: error instanceof Error ? error.message : 'Unknown MCP transport error.',
        });
      }
    }
  });
}

export function resolveHttpConfig(env: NodeJS.ProcessEnv = process.env): HttpConfig {
  const port = parsePort(env.PORT);
  const host = env.HOST?.trim() || DEFAULT_HOST;
  const token = env.GITPIN_MCP_TOKEN?.trim() || env.REPOCONTEXT_MCP_TOKEN?.trim() || '';
  const allowedHosts = parseList(env.GITPIN_ALLOWED_HOSTS ?? env.REPOCONTEXT_ALLOWED_HOSTS);
  const allowedOrigins = parseList(env.GITPIN_ALLOWED_ORIGINS).map((origin) => {
    try {
      return normalizeOrigin(origin);
    } catch {
      throw new Error(
        `Invalid GITPIN_ALLOWED_ORIGINS entry: ${origin}. Use scheme://host[:port], such as https://console.example.com.`,
      );
    }
  });
  if (!isLoopbackHost(host) && allowedHosts.length === 0) {
    throw new Error(
      `HOST=${host} is a non-loopback bind address; set GITPIN_ALLOWED_HOSTS to the public hostname(s) clients use, or bind HOST=127.0.0.1.`,
    );
  }
  return { host, port, token, allowedHosts, allowedOrigins };
}

export async function runHttpServer(): Promise<void> {
  const { host, port, token, allowedHosts, allowedOrigins } = resolveHttpConfig();
  const server = createHttpServer({ token, allowedHosts, allowedOrigins });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  console.error(`[gitpin] MCP server ready (http) on ${host}:${port}/api/mcp`);
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return LOOPBACK_HOSTNAMES.has(normalized) || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(normalized);
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  const originOnly = url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;
  if (!['http:', 'https:'].includes(url.protocol) || !originOnly) throw new Error(`Invalid origin: ${value}`);
  return url.origin;
}

function originAllowed(request: IncomingMessage, allowedOrigins: Set<string>): boolean {
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  return isLoopbackHost(url.hostname) || allowedOrigins.has(url.origin);
}

function authorized(request: IncomingMessage, expectedToken: string): boolean {
  const header = request.headers.authorization ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const provided = Buffer.from(header.slice(prefix.length), 'utf-8');
  const expected = Buffer.from(expectedToken, 'utf-8');
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function requestContentLength(request: IncomingMessage): number | null | undefined {
  const value = request.headers['content-length'];
  if (value === undefined) return undefined;
  if (!/^\d+$/u.test(value)) return null;
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : null;
}

function hostAllowed(request: IncomingMessage, allowedHosts: Set<string>): boolean {
  if (allowedHosts.size === 0) return true;
  const host = (request.headers.host ?? '').split(':')[0].toLowerCase();
  return allowedHosts.has(host);
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('content-security-policy', "default-src 'none'");
  response.setHeader('x-content-type-options', 'nosniff');
}

function sendJson(response: ServerResponse, status: number, value: unknown, omitBody = false): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(omitBody ? undefined : JSON.stringify(value));
}

function parsePort(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '3000', 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`Invalid PORT: ${value ?? ''}`);
  }
  return parsed;
}

if (require.main === module) {
  runHttpServer().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
