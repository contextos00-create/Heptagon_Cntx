/**
 * TanStack Start–friendly server functions for this Express + Vite app.
 *
 * Client code calls the same function names as the server. On the server the
 * handler runs in-process. In the browser a single Start-style RPC posts to
 * `/_server/fn` — no hand-rolled REST resources, adapters, or proxies.
 */

export type ServerFnHandler<TIn = unknown, TOut = unknown> = (
  input: TIn
) => TOut | Promise<TOut>;

const REGISTRY_KEY = '__heptaServerFnRegistry__';

type Registry = Map<string, ServerFnHandler>;

function getRegistry(): Registry {
  const g = globalThis as typeof globalThis & { [REGISTRY_KEY]?: Registry };
  if (!g[REGISTRY_KEY]) g[REGISTRY_KEY] = new Map();
  return g[REGISTRY_KEY]!;
}

export function registerServerFn<TIn, TOut>(
  name: string,
  handler: ServerFnHandler<TIn, TOut>
): void {
  getRegistry().set(name, handler as ServerFnHandler);
}

export function getRegisteredServerFn(name: string): ServerFnHandler | undefined {
  return getRegistry().get(name);
}

export function listRegisteredServerFns(): string[] {
  return [...getRegistry().keys()];
}

async function invokeRemote<TOut>(name: string, input: unknown): Promise<TOut> {
  const res = await fetch('/_server/fn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ fn: name, input }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(payload?.error || res.statusText || 'Server function failed'), {
      code: payload?.code,
      data: payload,
    });
  }
  return payload.result as TOut;
}

/**
 * Create a callable server function. Import this from UI code and call it
 * like a normal async function — never write fetch/HTTP yourself.
 */
export function createServerFn<TIn = void, TOut = unknown>(name: string) {
  const fn = (async (input?: TIn): Promise<TOut> => {
    if (typeof window === 'undefined') {
      const handler = getRegisteredServerFn(name);
      if (!handler) {
        throw new Error(`Server function "${name}" is not registered on the server`);
      }
      return (await handler(input as TIn)) as TOut;
    }
    return invokeRemote<TOut>(name, input as TIn);
  }) as {
    (input: TIn): Promise<TOut>;
    __serverFnName: string;
  };
  fn.__serverFnName = name;
  return fn;
}

/** Express/Node mount: one Start-style endpoint for every registered fn. */
export async function handleServerFnRequest(body: {
  fn?: string;
  input?: unknown;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const name = body?.fn;
  if (!name || typeof name !== 'string') {
    return { status: 400, body: { error: 'fn name is required' } };
  }
  const handler = getRegisteredServerFn(name);
  if (!handler) {
    return { status: 404, body: { error: `Unknown server function: ${name}` } };
  }
  try {
    const result = await handler(body.input);
    return { status: 200, body: { result } };
  } catch (err: any) {
    const status = err?.code === 'STALE_VERSION' ? 409 : 400;
    return {
      status,
      body: {
        error: err?.message || 'Server function failed',
        code: err?.code,
        currentVersion: err?.currentVersion,
        baseBoardVersion: err?.baseBoardVersion,
      },
    };
  }
}
