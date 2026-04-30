-- Migration: menus + recipe_items + RLS
-- Spec: data-model.md §6, FR-003/019/038
-- 헌법 IV: user_id 격리. 헌법 III: 메뉴 원가는 클라이언트/RPC에서 계산 (캐시 안 함)

-- ─── menus ──────────────────────────────────────────────────────
create table public.menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint menus_name_per_user_unique unique (user_id, name),
  constraint menus_price_nonneg check (price >= 0),
  constraint menus_name_length check (char_length(name) between 1 and 50)
);

comment on table public.menus is '메뉴. 이름은 사용자 단위 unique (FR-038). 활성·비활성 모두 unique 적용.';
comment on column public.menus.price is '판매 가격. 판매 시점 스냅샷은 sale_items.unit_price.';

create index menus_user_active_idx on public.menus (user_id, is_active);

create trigger menus_set_updated_at
before update on public.menus
for each row
execute function public.set_updated_at();

-- ─── recipe_items ───────────────────────────────────────────────
create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity_per_serving numeric(12, 3) not null,
  created_at timestamptz not null default now(),

  constraint recipe_items_menu_ingredient_unique unique (menu_id, ingredient_id),
  constraint recipe_items_quantity_positive check (quantity_per_serving > 0)
);

comment on table public.recipe_items is '메뉴 1인분 레시피. (menu_id, ingredient_id) unique — 한 메뉴에 같은 재료 중복 등록 금지.';
comment on column public.recipe_items.quantity_per_serving is '1회 제공량 (재료 단위 기준 — g/ml/piece).';

create index recipe_items_menu_idx on public.recipe_items (menu_id);
create index recipe_items_ingredient_idx on public.recipe_items (ingredient_id);

-- ─── RLS (헌법 IV) ──────────────────────────────────────────────
alter table public.menus enable row level security;
alter table public.recipe_items enable row level security;

create policy menus_isolated
on public.menus
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy recipe_items_isolated
on public.recipe_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.menus to authenticated;
grant select, insert, update, delete on public.recipe_items to authenticated;
