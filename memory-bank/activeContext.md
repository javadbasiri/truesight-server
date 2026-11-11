# Active Context

## Recent Milestones Achieved
- ساخت `ProcessedGameState` و `GameStateProcessorService` برای نرمال‌سازی GSI
  (پشتیبانی از `allplayers`، `draft`، `roshan_state`، دسته‌بندی درست تاورها با
  کلیدهای واقعی `tower1..tower4` و `rax`).
- پیاده‌سازی ۲۱ سرویس تخصصی کوچینگ: `WinConditionAnalyzer`, `NetWorthTracker`,
  `CombatAnalyzer`, `LaningCoach`, `MidgameCoach`, `LategameCoach`,
  `PushTimingDetector`, `AntiThrow`, `SituationDatabase` (۵۳ موقعیت),
  `PhaseCoaching`, `ItemBuildAdvisor`, `HeroSpecificAdvice` (۱۷ هیرو),
  `ConfidenceCalculator`, `PlayerTrustCalibrator`, `MessageQueue`,
  `MessageFormatter`, `PostGameAnalyzer`, `WinrateTracker`, `DoNothingDetector`,
  `SteamChatBot` و `CoachingEngine`.
- `CoachingEngineService` ارزیابی stateful با throttle یک‌بار در هر ثانیه‌ی بازی،
  تشخیص مچ جدید/عقب‌رفتن تایمر دمو، صف پیام اولویت‌دار، سرکوب توصیه‌ی کم‌اطمینان و
  سکوت عمدی را انجام می‌دهد.
- قرارداد Socket.io توسعه یافت (به‌صورت additive): رویدادهای `coaching-status` و
  `post-game-summary`؛ قرارداد `coach-alert` دست‌نخورده ماند.
- افزودن `CoachingController` با `GET /coach/status`، `GET /coach/post-game` و
  `POST /coach/reset`.
- افزودن فایل `gamestate_integration_truesight.cfg` با سکشن‌های `allplayers` و
  `draft` برای فعال‌سازی تحلیل دشمن.
- تست‌ها: ۱۷ unit test (processor, message queue, engine) و ۴ e2e test
  (`GET /`, `POST /gsi`, `GET /coach/status`, `GET /coach/post-game`).

## Next Immediate Steps
1. افزودن ارزیاب Bottle (`contains_rune`) و کول‌داون آنلتی/BKB به `RuleEngineService`.
2. ثبت رویداد مرگ/اسپاون روشان از سکشن `events` برای تخمین دقیق‌تر از `roshan_state`.
3. پروفایل‌های میدلین مخصوص هیرو (Shadow Fiend، Puck، Lina، QoP، Void Spirit، TA).
4. مصرف `coaching-status` و `post-game-summary` در `truesight-client` (پنل تحلیل و
   نمایش شرط برد/اعتماد).
5. اتصال `WinrateTracker.recordOutcome` به سیگنال واقعی نتیجه‌ی فایت.
6. لایه‌ی SaaS: Prisma + PostgreSQL برای تاریخچه‌ی مچ و اعتبارسنجی لایسنس.
