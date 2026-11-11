# System Patterns & Architecture

## Data Flow Pipeline
`Dota 2 Client (HTTP POST /gsi)` → `GsiController`
- → `RuleEngineService` (تایمرهای ماکرو، منابع هیرو، پاور اسپایک آیتم)
- → `CoachingEngineService` (تصمیم‌گیری استراتژیک)
  → `CoachGateway (Socket.io)` → `truesight-client`

## Coaching Decision Pipeline
1. **Normalize:** `GameStateProcessorService` پکت خام را به `ProcessedGameState` تبدیل می‌کند.
2. **Match lifecycle:** تشخیص مچ جدید یا عقب‌رفتن تایمر (دمو) و ریست کامل state.
3. **Candidates (به ترتیب اولویت):** combat → phase coach → situation DB → anti-throw →
   push windows → net worth → phase coaching → item build → hero specific → ability tips.
4. **Silence:** اگر `DoNothingDetector` تأیید کند، هیچ پیامی تولید نمی‌شود.
5. **Enrichment:** `ConfidenceCalculator` نمره‌ی اطمینان می‌دهد، توصیه‌ی کم‌اطمینان سرکوب
   یا لحنش نرم می‌شود و در صورت نیاز توضیح اضافه می‌شود.
6. **Delivery:** `MessageQueue` بر اساس اولویت Rate Limit اعمال می‌کند؛ `MessageFormatter`
   پیام فارسی را برای موقعیت پراسترس کوتاه/برجسته می‌کند؛ `CoachGateway` ارسال می‌کند.
7. **Learning:** `PlayerTrustCalibrator` پایبندی بازیکن را از تیک‌های بعدی استنتاج می‌کند و
   `PostGameAnalyzer` رویدادها را برای تحلیل پس از بازی ثبت می‌کند.

## Key Architectural Patterns
1. **Loopback Isolation (`127.0.0.1:4000`):** بایند مستقیم روی لوکال‌هاست برای عبور از
   آداپتورهای VPN (Windscribe، FortiClient) و ارتباط زیرمیلی‌ثانیه‌ای با دوتا ۲ و کلاینت Tauri.
2. **Idempotent & De-bounced Rules:** دوتا ۲ هر ~۱۰۰ms یک snapshot می‌فرستد (`buffer: 0.1`, `throttle: 0.1`)، بنابراین:
   - *موتور کوچینگ* حداکثر یک‌بار در هر ثانیه‌ی بازی ارزیابی می‌کند (`clockTime` + throttle زمانی).
   - *قوانین زمانی* `lastTriggeredClockTime` را دنبال می‌کنند تا حداکثر یک‌بار در هر ثانیه شلیک شوند.
   - *قوانین آستانه‌ای* از Hysteresis (مانا < ۲۵٪، ریست > ۳۵٪) استفاده می‌کنند.
   - *قوانین موقعیت/آیتم* کول‌داون اختصاصی (۳۰–۱۲۰ ثانیه) و state diffing دارند.
   - *صف پیام* اولویت‌های `GAME_ENDING/CRITICAL/HIGH/MEDIUM/LOW` را Rate Limit می‌کند.
3. **Fast HTTP Acknowledge:** `POST /gsi` همیشه سریع `@HttpCode(200)` برمی‌گرداند تا
   کلاینت Source 2 اتصال GSI را قطع یا throttle نکند.
4. **Additive Socket Contract:** قرارداد `coach-alert` بدون تغییر ماند؛ رویدادهای
   `coaching-status` و `post-game-summary` به‌صورت افزایشی اضافه شدند.
5. **Optional Integrations:** `SteamChatBotService` با `@Optional()` تزریق می‌شود؛ نبود
   پکیج/اعتبارنامه هیچ تأثیری روی مسیر اصلی Socket.io ندارد.
