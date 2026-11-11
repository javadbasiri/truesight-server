# TrueSight Coach Server

موتور تحلیل و کوچینگ زنده‌ی دوتا ۲. این سرور پکت‌های **Game State Integration (GSI)**
را از کلاینت دوتا ۲ دریافت می‌کند، وضعیت مچ را به‌صورت stateful پردازش می‌کند و
توصیه‌های کوتاه، اقدام‌محور و فارسی را از طریق **Socket.io** به `truesight-client`
(اورلی Tauri) می‌فرستد.

> فلسفه: هر توصیه باید به این سؤال جواب بدهد که «آیا این اقدام ما را سریع‌تر به
> زدن Ancient دشمن نزدیک می‌کند؟»

## قابلیت‌ها

### موتور کوچینگ (`src/coaching`)
- **تحلیل ترکیب و شرط برد:** `earlyPush`، `timingPush`، `splitPush`، `highgroundSiege`، `outscale`.
- **تشخیص پنجره‌ی پوش:** مرگ هم‌زمان دشمن، کری بدون بای‌بک، پاور اسپایک آیتم، برتری آنلتی، آیجیس و تاور کم‌جان.
- **سیستم ضد ترو:** دکمه‌های رایج باختن بازی (دایو در فوگ، روشان بدون دید، فارم با برتری ۸ هزار گلد و ...).
- **کوچ فازبندی‌شده:** لینینگ (۰–۱۰)، میدگیم (۱۰–۳۰) و لیت‌گیم (۳۰+).
- **تحلیل نبرد لحظه‌ای:** تخمین شانس برد بر اساس لول، ارزش خالص، جان/مانا، تعداد نفرات و مچاپ.
- **پایگاه ۵۳ موقعیت:** دتکشن هیروهای اینویز، نیاز به BKB، تایمینگ روشان، ریسک هایگراند، تایمینگ تالنت و ...
- **مشاور آیتم و هیرو:** پیشنهاد آیتم بعدی بر اساس هیرو، گلد و تهدیدهای دشمن + توصیه‌های مخصوص ۱۷ هیرو.
- **اطمینان‌سنجی:** هر توصیه نمره‌ی Confidence می‌گیرد؛ توصیه‌های کم‌اطمینان سرکوب یا لحنشان نرم می‌شود.
- **صف پیام و Rate Limit:** جلوگیری کامل از اسپم بر اساس اولویت (`GAME_ENDING` تا `LOW`).
- **کالیبراسیون اعتماد:** نرخ پایبندی بازیکن اندازه‌گیری و میزان توضیح/تکرار پیام تنظیم می‌شود.
- **سکوت عمدی:** وقتی «هیچ کاری نکردن» بهترین تصمیم است، پیام تولید نمی‌شود.
- **تحلیل بعد از بازی:** پنجره‌های از دست‌رفته، لحظات تعیین‌کننده و پیشنهادهای قابل اقدام.
- **تحویل اختیاری در چت استیم:** با تنظیم `STEAM_USERNAME`/`STEAM_PASSWORD` و نصب پکیج اختیاری `steam-user`.

### قوانین ماکرو و منابع (`RuleEngineService`)
- رون آب، رون پاور، رون ویزدام، لوتوس، استک کمپ و اولین شب.
- هشدار جان/مانای کم با Hysteresis، بای‌بک لیت‌گیم و پاور اسپایک ۱۰ آیتم کلیدی.

## راه‌اندازی

```bash
npm install
npm run start:dev
```

سرور فقط روی لوکال‌هاست بایند می‌شود: `http://127.0.0.1:4000`

### تنظیم دوتا ۲

1. فایل `gamestate_integration_truesight.cfg` (در ریشه‌ی همین ریپو) را در مسیر زیر کپی کنید:

```
Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\
```

2. در Steam → Properties → Launch Options مقدار `-gamestateintegration` را اضافه کنید.

> سکشن `allplayers` برای تحلیل دشمن (مرگ، بای‌بک، ارزش خالص و ترکیب تیمی) ضروری است.
> بدون آن، موتور کوچینگ فقط از داده‌ی هیروی خودتان استفاده می‌کند.

## قرارداد Socket.io

| رویداد | payload |
| --- | --- |
| `coach-alert` | `{ id: string; message: string; type: 'info' \| 'warning' \| 'spike'; audioKey?: string }` |
| `game-state` | خلاصه‌ی مپ/بازیکن/هیرو برای داشبورد |
| `coaching-status` | `{ inGame, matchId, clockTime, gamePhase, winCondition, netWorth, trustMetrics, lastAdvice, lastAlertAt }` |
| `post-game-summary` | `{ text: string; summary: PostGameSummary }` |

## HTTP API

| متد | مسیر | توضیح |
| --- | --- | --- |
| `POST` | `/gsi` | دریافت پکت GSI (همیشه `200`) |
| `GET` | `/` | health check |
| `GET` | `/coach/status` | وضعیت زنده‌ی موتور کوچینگ |
| `GET` | `/coach/post-game` | تحلیل بعد از بازی |
| `POST` | `/coach/reset` | ریست دستی state موتور |

## تست و کیفیت

```bash
npm run test        # unit tests (vitest)
npm run test:e2e    # e2e tests (POST /gsi، /coach/status)
npm run lint        # oxlint (type-aware)
npm run build       # nest build
```

## معماری

```
Dota 2 (POST /gsi)
   └─ GsiController (thin, @HttpCode(200))
        ├─ RuleEngineService  → تایمرهای ماکرو و منابع
        └─ CoachingEngineService
             ├─ GameStateProcessor (GSI → ProcessedGameState)
             ├─ WinConditionAnalyzer / NetWorthTracker / CombatAnalyzer
             ├─ LaningCoach / MidgameCoach / LategameCoach
             ├─ PushTimingDetector / AntiThrow / SituationDatabase
             ├─ ItemBuildAdvisor / HeroSpecificAdvice
             ├─ ConfidenceCalculator / PlayerTrustCalibrator
             ├─ MessageQueue / MessageFormatter
             └─ PostGameAnalyzer / WinrateTracker
                   └─ CoachGateway → Socket.io → truesight-client
```

قواعد ضد اسپم: ارزیابی حداکثر یک بار در هر ثانیه‌ی بازی، کول‌داون هر موقعیت،
قفل Hysteresis برای آستانه‌ها و Rate Limit بر اساس اولویت پیام.
