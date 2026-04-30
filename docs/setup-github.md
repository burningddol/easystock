# GitHub Repo 셋업 가이드

이지스톡 리포지토리의 branch protection + secrets 등록 절차. **수동 단계** — 한 번만 수행하면 됨.

## 1. Branch Protection (master)

Settings → Branches → Add classic branch protection rule:

| 설정                                                             | 값                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Branch name pattern                                              | `master`                                                                                |
| Require a pull request before merging                            | ✅                                                                                      |
| Require approvals                                                | 1 (1인 개발이면 0으로 설정 가능)                                                        |
| Dismiss stale pull request approvals when new commits are pushed | ✅                                                                                      |
| Require status checks to pass before merging                     | ✅                                                                                      |
| Require branches to be up to date before merging                 | ✅                                                                                      |
| Status checks (required)                                         | `Lint + Typecheck`, `Unit + Integration Tests`, `Build`, `E2E Tests`, `codecov/project` |
| Require conversation resolution before merging                   | ✅                                                                                      |
| Require signed commits                                           | 권장 (GPG 키 등록 필요)                                                                 |
| Restrict who can push to matching branches                       | (선택)                                                                                  |

`001-mvp-core` 브랜치에도 같은 규칙 적용 권장 (Phase가 끝날 때 master로 머지될 때까지 작업 브랜치이므로).

## 2. Secrets 등록 (Repository secrets)

Settings → Secrets and variables → Actions → New repository secret.

### Supabase

| 키                          | 출처                                                    | 비고                                      |
| --------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `SUPABASE_URL`              | Supabase Dashboard → Settings → API → Project URL       | `NEXT_PUBLIC_SUPABASE_URL`로 빌드 시 노출 |
| `SUPABASE_ANON_KEY`         | 같은 페이지의 anon public key                           | `NEXT_PUBLIC_SUPABASE_ANON_KEY`           |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (절대 클라이언트 노출 금지)            | Edge Function용                           |
| `SUPABASE_PROJECT_REF`      | Project URL 마지막 segment (예: `abcdefghij`)           | CLI deploy/link                           |
| `SUPABASE_ACCESS_TOKEN`     | https://supabase.com/dashboard/account/tokens 에서 생성 | CLI 인증                                  |
| `SUPABASE_DB_PASSWORD`      | 프로젝트 생성 시 설정한 DB 비번                         | `db push`용                               |

### PWA Push (VAPID)

| 키                  | 출처                                     | 비고                                      |
| ------------------- | ---------------------------------------- | ----------------------------------------- |
| `VAPID_PUBLIC_KEY`  | `npx web-push generate-vapid-keys`       | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`로 노출     |
| `VAPID_PRIVATE_KEY` | 같은 명령                                | Edge Function `push-scheduler`에서만 사용 |
| `VAPID_SUBJECT`     | `mailto:hello@easystock.com` 같은 연락처 | 표준                                      |

상세는 [setup-vapid.md](./setup-vapid.md) 참조.

### 분석 / 오류 추적

| 키                   | 출처                                           | 비고                                      |
| -------------------- | ---------------------------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_GA4_ID` | GA4 → 데이터 스트림 → 측정 ID (`G-XXXXXXXX`)   | 클라이언트 노출                           |
| `SENTRY_DSN`         | Sentry 프로젝트 → Settings → Client Keys (DSN) | `NEXT_PUBLIC_SENTRY_DSN`으로 빌드 시 매핑 |
| `SENTRY_ORG`         | Sentry 조직 slug                               | source maps 업로드용                      |
| `SENTRY_PROJECT`     | Sentry 프로젝트 slug                           | 같음                                      |
| `SENTRY_AUTH_TOKEN`  | Sentry → User → Auth Tokens                    | source maps 업로드 권한                   |

### CI / 배포

| 키                  | 출처                                                              | 비고                                |
| ------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `CODECOV_TOKEN`     | Codecov 프로젝트 페이지 → Settings → Repository upload token      | private repo만 필요 (public은 자동) |
| `VERCEL_TOKEN`      | Vercel → Settings → Tokens                                        | preview/prod 배포                   |
| `VERCEL_ORG_ID`     | Vercel project Settings → General → Project ID 위 Organization ID |                                     |
| `VERCEL_PROJECT_ID` | 같은 페이지 Project ID                                            |                                     |

## 3. Environment 설정 (production / staging)

Settings → Environments → New environment:

- **production**: `migrate-db.yml`과 `deploy-edge-functions.yml`이 사용
  - Required reviewers: 본인 (1인 개발이면 자기 승인)
  - Deployment branches: `master`만 허용
- **staging**: `migrate-db.yml` workflow_dispatch 입력으로 사용 가능
  - Required reviewers: 없음
  - Deployment branches: `001-mvp-core` 또는 모든 브랜치

각 environment에 위 secrets 중 환경별로 다를 수 있는 것(예: 다른 SUPABASE_PROJECT_REF)을 environment-scoped secret으로 등록 가능.

## 4. Default branch 변경 (선택)

마스터(master) 브랜치명을 main으로 바꾸려면:

```bash
git branch -m master main
git push origin main
git push origin --delete master
```

GitHub Settings → General → Default branch에서도 변경. `.github/workflows/*.yml` 파일들의 `branches: [master, ...]` 항목도 일괄 갱신.

본 프로젝트는 master 그대로 진행 중.

## 5. 셋업 검증

1. PR 생성 → CI 4 jobs 자동 실행 + Codecov 업로드
2. CI 모두 green + 1 approval (또는 0) → merge 버튼 활성화
3. master push 시 Vercel 자동 배포
4. supabase/functions/\*\* 변경 시 Edge Functions 자동 배포
5. Actions tab → Migrate DB workflow → workflow_dispatch → environment 선택 → 마이그레이션 적용

문제 발생 시 Actions 탭에서 실패 로그 확인 → docs 또는 코드 수정 → 재푸시.
