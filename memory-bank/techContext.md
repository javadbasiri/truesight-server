# Technical Context

## Backend Stack
- **Framework:** NestJS (Node.js / TypeScript, ESM با `module: nodenext`)
- **WebSockets:** `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`
- **Database (Planned):** PostgreSQL with Prisma ORM
- **In-Memory State / Caching:** Native TypeScript Map/state services (upgradable to Redis)
- **Optional:** `steam-user` برای تحویل توصیه‌ها در چت استیم (نصب اختیاری)

## Module Layout
- `src/gsi.controller.ts` — لایه‌ی نازک دریافت GSI (`@HttpCode(200)`).
- `src/gsi/interfaces/` — تایپ‌های خام GSI و `ProcessedGameState` + `RuleEngineService`.
- `src/coaching/` — ماژول کوچینگ:
  - `interfaces/coaching.interface.ts` — `CoachingAdvice`, `MessagePriority`, `WinCondition`, `PostGameSummary`, `TrustMetrics` و ...
  - `config/coaching.constants.ts` — شرط‌های برد، پاور اسپایک‌ها، Rate Limit، CS Target، فازهای بازی.
  - `services/*.service.ts` — ۲۱ سرویس تخصصی و `CoachingEngineService`.
  - `coaching.controller.ts` — `GET /coach/status`, `GET /coach/post-game`, `POST /coach/reset`.
- `src/coach.gateway.ts` — Socket.io: `coach-alert`, `game-state`, `coaching-status`, `post-game-summary`.

## Dota 2 GSI Integration Specs
- **Config File:** `Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\gamestate_integration_truesight.cfg`
- **Repo Template:** `gamestate_integration_truesight.cfg` (ریشه‌ی پروژه)
- **Steam Launch Option:** `-gamestateintegration`
- **Target Endpoint:** `http://127.0.0.1:4000/gsi`
- **Active GSI Sections:** `provider`, `map`, `player`, `hero`, `abilities`, `items`, `draft`, `allplayers`, `buildings`, `events`.
- **نکته‌ی مهم:** بدون `allplayers`، تحلیل دشمن (مرگ، بای‌بک، ارزش خالص، ترکیب تیمی و دتکشن هیرو) غیرفعال است.
  GSI استاندارد نام هیروی دشمن را نمی‌دهد؛ `hero_name`/`hero_id` در `allplayers` برای منابع غنی‌شده پشتیبانی می‌شود.
- **Roshan:** `map.roshan_state` (`alive` / `dead` / `respawn_timer`) و `map.roshan_state_end_seconds`.

## Quality Gates
- `npm run build` (nest build / tsc)
- `npm run lint` (oxlint type-aware، باید ۰ error باشد)
- `npm run test` (vitest، ۱۷ تست)
- `npm run test:e2e` (vitest + supertest، ۴ تست)
