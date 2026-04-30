-- Migration: menu_templates (read-only seed) — 빙수카페 8 + 카페 10
-- Spec: FR-003, contracts/domain-rpc.md `clone_menu_template`
-- 모든 사용자가 SELECT 가능, INSERT/UPDATE/DELETE는 service_role만.

create table public.menu_templates (
  id uuid primary key default gen_random_uuid(),
  store_type public.store_type not null,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  recipe jsonb not null,

  constraint menu_templates_unique unique (store_type, name),
  constraint menu_templates_recipe_array check (jsonb_typeof(recipe) = 'array')
);

comment on table public.menu_templates is
  '읽기 전용 메뉴 템플릿. clone_menu_template RPC가 사용자별 menus/ingredients/recipe_items로 복제.';
comment on column public.menu_templates.recipe is
  'JSONB 배열: [{"ingredient_name": text, "unit": ingredient_unit, "quantity": numeric}, ...]';

create index menu_templates_store_type_idx on public.menu_templates (store_type);

-- 모든 인증 사용자가 읽기. 쓰기는 RPC(security definer)에서만 — 직접 INSERT 차단.
alter table public.menu_templates enable row level security;

create policy menu_templates_read_all
on public.menu_templates
for select
to authenticated
using (true);

grant select on public.menu_templates to authenticated;

-- ─── 시드: 빙수카페 8종 ─────────────────────────────────────────
insert into public.menu_templates (store_type, name, price, recipe) values
  ('bingsu_cafe', '팥빙수', 9000, '[
    {"ingredient_name": "얼음", "unit": "g", "quantity": 300},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 100},
    {"ingredient_name": "팥", "unit": "g", "quantity": 80},
    {"ingredient_name": "연유", "unit": "ml", "quantity": 20}
  ]'::jsonb),
  ('bingsu_cafe', '망고빙수', 12000, '[
    {"ingredient_name": "얼음", "unit": "g", "quantity": 300},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 100},
    {"ingredient_name": "망고", "unit": "g", "quantity": 120},
    {"ingredient_name": "연유", "unit": "ml", "quantity": 20}
  ]'::jsonb),
  ('bingsu_cafe', '딸기빙수', 11000, '[
    {"ingredient_name": "얼음", "unit": "g", "quantity": 300},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 100},
    {"ingredient_name": "딸기", "unit": "g", "quantity": 120},
    {"ingredient_name": "연유", "unit": "ml", "quantity": 20}
  ]'::jsonb),
  ('bingsu_cafe', '인절미빙수', 10000, '[
    {"ingredient_name": "얼음", "unit": "g", "quantity": 300},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 100},
    {"ingredient_name": "인절미", "unit": "g", "quantity": 60},
    {"ingredient_name": "콩가루", "unit": "g", "quantity": 15}
  ]'::jsonb),
  ('bingsu_cafe', '흑임자빙수', 10500, '[
    {"ingredient_name": "얼음", "unit": "g", "quantity": 300},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 100},
    {"ingredient_name": "흑임자가루", "unit": "g", "quantity": 25},
    {"ingredient_name": "연유", "unit": "ml", "quantity": 20}
  ]'::jsonb),
  ('bingsu_cafe', '초코빙수', 10000, '[
    {"ingredient_name": "얼음", "unit": "g", "quantity": 300},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 100},
    {"ingredient_name": "초코시럽", "unit": "ml", "quantity": 40},
    {"ingredient_name": "초코칩", "unit": "g", "quantity": 20}
  ]'::jsonb),
  ('bingsu_cafe', '과일빙수', 12000, '[
    {"ingredient_name": "얼음", "unit": "g", "quantity": 300},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 100},
    {"ingredient_name": "딸기", "unit": "g", "quantity": 50},
    {"ingredient_name": "망고", "unit": "g", "quantity": 50},
    {"ingredient_name": "블루베리", "unit": "g", "quantity": 30},
    {"ingredient_name": "연유", "unit": "ml", "quantity": 20}
  ]'::jsonb),
  ('bingsu_cafe', '녹차빙수', 10500, '[
    {"ingredient_name": "얼음", "unit": "g", "quantity": 300},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 100},
    {"ingredient_name": "녹차파우더", "unit": "g", "quantity": 10},
    {"ingredient_name": "팥", "unit": "g", "quantity": 50}
  ]'::jsonb);

-- ─── 시드: 카페 음료 10종 ───────────────────────────────────────
insert into public.menu_templates (store_type, name, price, recipe) values
  ('cafe', '아메리카노', 4500, '[
    {"ingredient_name": "원두", "unit": "g", "quantity": 18}
  ]'::jsonb),
  ('cafe', '카페라떼', 5000, '[
    {"ingredient_name": "원두", "unit": "g", "quantity": 18},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 200}
  ]'::jsonb),
  ('cafe', '카푸치노', 5000, '[
    {"ingredient_name": "원두", "unit": "g", "quantity": 18},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 150}
  ]'::jsonb),
  ('cafe', '바닐라라떼', 5500, '[
    {"ingredient_name": "원두", "unit": "g", "quantity": 18},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 200},
    {"ingredient_name": "바닐라시럽", "unit": "ml", "quantity": 20}
  ]'::jsonb),
  ('cafe', '카라멜마키아토', 5800, '[
    {"ingredient_name": "원두", "unit": "g", "quantity": 18},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 200},
    {"ingredient_name": "카라멜시럽", "unit": "ml", "quantity": 20}
  ]'::jsonb),
  ('cafe', '카페모카', 5800, '[
    {"ingredient_name": "원두", "unit": "g", "quantity": 18},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 200},
    {"ingredient_name": "초코시럽", "unit": "ml", "quantity": 25}
  ]'::jsonb),
  ('cafe', '콜드브루', 5500, '[
    {"ingredient_name": "콜드브루원두", "unit": "g", "quantity": 25}
  ]'::jsonb),
  ('cafe', '아이스티', 4500, '[
    {"ingredient_name": "복숭아아이스티파우더", "unit": "g", "quantity": 30}
  ]'::jsonb),
  ('cafe', '레몬에이드', 5500, '[
    {"ingredient_name": "레몬시럽", "unit": "ml", "quantity": 50},
    {"ingredient_name": "탄산수", "unit": "ml", "quantity": 200}
  ]'::jsonb),
  ('cafe', '핫초코', 5000, '[
    {"ingredient_name": "초코파우더", "unit": "g", "quantity": 25},
    {"ingredient_name": "우유", "unit": "ml", "quantity": 250}
  ]'::jsonb);
