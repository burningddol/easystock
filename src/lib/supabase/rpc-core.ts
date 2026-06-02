interface RpcResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface ClientLike {
  rpc: unknown;
}

async function callRpc<T>(
  client: ClientLike,
  fn: string,
  args?: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const rpcFn = client.rpc as (...rest: unknown[]) => PromiseLike<RpcResult<T>>;
  const result = await Reflect.apply(rpcFn, client, args === undefined ? [fn] : [fn, args]);
  return result;
}

function numeric(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`numeric() received non-numeric value: ${value}`);
  }
  return n;
}

async function callRpcSingleRow<TRaw, TOut>(
  client: ClientLike,
  fn: string,
  args: Record<string, unknown>,
  mapRow: (row: TRaw) => TOut,
): Promise<RpcResult<TOut>> {
  const result = await callRpc<TRaw[]>(client, fn, args);
  if (result.error || !result.data?.[0]) {
    return { data: null, error: result.error };
  }
  return { data: mapRow(result.data[0]), error: null };
}

async function callRpcMapped<TRaw, TOut>(
  client: ClientLike,
  fn: string,
  args: Record<string, unknown> | undefined,
  map: (raw: TRaw) => TOut,
): Promise<RpcResult<TOut>> {
  const result = await callRpc<TRaw>(client, fn, args);
  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }
  return { data: map(result.data), error: null };
}

export type { ClientLike, RpcResult };
export { callRpc, callRpcMapped, callRpcSingleRow, numeric };
