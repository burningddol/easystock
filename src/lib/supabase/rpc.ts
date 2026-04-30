import type { Database } from "./types";

type Weekday = Database["public"]["Enums"]["weekday"];
type StoreType = Database["public"]["Enums"]["store_type"];

/**
 * 타입 있는 RPC 래퍼.
 *
 * Supabase v2 rpc() 제네릭이 자동 생성 Database 타입과 일부 추론 충돌이 있어
 * 런타임 결과를 명시 타입으로 단언한다 (이 wrapping이 unsafe-cast 지점).
 * 또한 분리된 변수에 rpc를 대입하면 `this` 바인딩이 끊겨 Supabase 내부
 * fetcher가 깨지므로 `Reflect.apply`로 client를 receiver로 유지.
 */

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

interface UpdateRegularDaysOffArgs {
  p_days_off: readonly Weekday[];
}

interface UpdateRegularDaysOffRow {
  success: boolean;
  days_off: Weekday[];
}

export function updateRegularDaysOff(
  client: ClientLike,
  args: UpdateRegularDaysOffArgs,
): Promise<RpcResult<UpdateRegularDaysOffRow[]>> {
  return callRpc(client, "update_regular_days_off", { p_days_off: [...args.p_days_off] });
}

interface RequestWithdrawalRow {
  success: boolean;
  permanent_delete_at: string;
}

export function requestWithdrawal(
  client: ClientLike,
): Promise<RpcResult<RequestWithdrawalRow[]>> {
  return callRpc(client, "request_withdrawal");
}

interface CloneMenuTemplateRow {
  menu_ids: string[];
  ingredient_ids: string[];
}

export function cloneMenuTemplate(
  client: ClientLike,
  args: { storeType: StoreType },
): Promise<RpcResult<CloneMenuTemplateRow[]>> {
  return callRpc(client, "clone_menu_template", { p_store_type: args.storeType });
}
