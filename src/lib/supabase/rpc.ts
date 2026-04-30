import { WEEKDAYS } from "@/features/auth/schemas";

type Weekday = (typeof WEEKDAYS)[number];

/**
 * 타입 있는 RPC 래퍼.
 *
 * Functions가 stub 단계라 supabase.rpc()의 제네릭 추론을 우회한다.
 * 실제 generated 타입(`supabase gen types typescript`)이 들어오면
 * 이 래퍼는 단순 위임이 되거나 제거 가능.
 */

interface RpcResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

type RpcCaller = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult<unknown>>;

interface ClientLike {
  rpc: unknown;
}

interface UpdateRegularDaysOffArgs {
  p_days_off: readonly Weekday[];
}

interface UpdateRegularDaysOffRow {
  success: boolean;
  days_off: Weekday[];
}

export async function updateRegularDaysOff(
  client: ClientLike,
  args: UpdateRegularDaysOffArgs,
): Promise<RpcResult<UpdateRegularDaysOffRow[]>> {
  const rpc = client.rpc as RpcCaller;
  const result = await rpc("update_regular_days_off", { p_days_off: [...args.p_days_off] });
  return result as RpcResult<UpdateRegularDaysOffRow[]>;
}

interface RequestWithdrawalRow {
  success: boolean;
  permanent_delete_at: string;
}

export async function requestWithdrawal(
  client: ClientLike,
): Promise<RpcResult<RequestWithdrawalRow[]>> {
  const rpc = client.rpc as RpcCaller;
  const result = await rpc("request_withdrawal");
  return result as RpcResult<RequestWithdrawalRow[]>;
}
