import { z } from "zod";

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export const STORE_TYPES = ["bingsu_cafe", "cafe", "dessert_cafe"] as const;

export const STORE_TYPE_LABELS: Record<(typeof STORE_TYPES)[number], string> = {
  bingsu_cafe: "빙수카페",
  cafe: "카페",
  dessert_cafe: "디저트카페",
};

export const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
};

export const signupSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
  storeName: z
    .string()
    .min(1, "가게 이름을 입력해주세요")
    .max(50, "가게 이름은 50자 이내로 입력해주세요"),
  storeType: z.enum(STORE_TYPES),
  regularDaysOff: z.array(z.enum(WEEKDAYS)).max(7),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

export type LoginInput = z.infer<typeof loginSchema>;
