# Project Progress: `truesight-server`

## What Works (Completed)
- [x] NestJS project setup with Socket.io WebSocket gateway (`CoachGateway`).
- [x] Loopback binding on `127.0.0.1:4000` with CORS enabled.
- [x] `POST /gsi` endpoint (`GsiController`) receiving live Dota 2 telemetry.
- [x] Complete TypeScript interfaces (`GsiPayload`, `CoachAlertPayload`) in `src/gsi/interfaces/gsi-payload.interface.ts`.
- [x] Modular `RuleEngineService` decoupled from `GsiController`.
- [x] Automatic state reset on new match ID or Demo Hero clock rewind.
- [x] Macro timers: Water Rune, Power Rune, Wisdom Rune, Lotus Pool, Camp Stacking, and First Night transition.
- [x] Hero resource & economy hysteresis rules: Low Mana, Low HP, and Late-Game Buyback status (25m+).
- [x] Slot-agnostic Inventory Power Spike detector with `audioKey` support for 10 core items.

### Coaching engine port
- [x] `ProcessedGameState` + `GameStateProcessorService` (allplayers, draft, roshan, items, abilities, buildings).
- [x] `WinConditionAnalyzerService` (earlyPush / timingPush / splitPush / highgroundSiege / outscale).
- [x] `PushTimingDetectorService` (hero deaths, no buyback, power spike, ultimate advantage, Aegis, creep wave).
- [x] `AntiThrowService` (chase, back after objective, Rosh without vision, buyback, over-farming, fighting without ults).
- [x] `LaningCoachService`, `MidgameCoachService`, `LategameCoachService` + `PhaseCoachingService`.
- [x] `SituationDatabaseService` with 53 concrete situations and per-situation cooldowns.
- [x] `CombatAnalyzerService` (win probability from level, net worth, HP/mana, numbers, items, matchup).
- [x] `ItemBuildAdvisorService` (21 hero builds, situational items, upgrades, consumables).
- [x] `HeroSpecificAdviceService` (17 heroes + ability-usage tips).
- [x] `ConfidenceCalculatorService` (data completeness, vision certainty, timing precision, net worth reliability).
- [x] `PlayerTrustCalibratorService` (compliance detection, weighted trust metrics, verbosity calibration).
- [x] `MessageQueueService` + `MessageFormatterService` (priority rate limits, Persian stress-aware formatting).
- [x] `NetWorthTrackerService` (delta trend, spike detection, strategic recommendation).
- [x] `PostGameAnalyzerService` (missed push windows, back opportunities, decisive moments, weighted summary).
- [x] `WinrateTrackerService` (combat predictions, winrate vs hero, accuracy).
- [x] `DoNothingDetectorService` (intentional silence integrated into the engine).
- [x] `SteamChatBotService` (optional steam-user chat delivery, "coach me" activation).
- [x] `CoachingEngineService` orchestrating priorities, throttle, reset, status and post-game events.
- [x] HTTP API: `GET /coach/status`, `GET /coach/post-game`, `POST /coach/reset`.
- [x] Socket events: `coaching-status`, `post-game-summary` (additive, `coach-alert` unchanged).
- [x] `gamestate_integration_truesight.cfg` with `allplayers` and `draft` sections.
- [x] 17 unit tests + 4 e2e tests, `npm run build` and `npm run lint` green.

## What's Left to Build (Backlog)
- [ ] **Bottle & Ability Tracking:** Alert when a bottled rune is about to expire (2-minute timer) or when Ultimate / BKB comes off cooldown.
- [ ] **Midlane Hero Profiles:** Custom rule modules tailored to specific hero mechanics and power spikes.
- [ ] **Event-Based Roshan/Tormentor Timers:** Consume `events` section instead of relying only on `roshan_state`.
- [ ] **Sub-Service Refactoring:** Split `RuleEngineService` into dedicated domain evaluators (`MacroTimerEvaluator`, `ResourceEvaluator`, `ItemSpikeEvaluator`) as rule count scales.
- [ ] **Database & SaaS Layer:** Prisma + PostgreSQL integration for match telemetry logging and user license validation.
- [ ] **Client Integration:** Consume `coaching-status` / `post-game-summary` in `truesight-client`.

## Known Issues / Edge Cases
- Buying, selling, and re-buying the exact same core item in a single match will only trigger the spike alert once due to the `notifiedItems` Set (acceptable behavior for standard matches).
- Without the `allplayers` GSI section, enemy-related rules (buyback, net worth delta, hero detection) are inert; confidence scoring falls back to neutral priors so own-hero advice still fires.
- `vanilla GSI` does not expose enemy hero names; `hero_name`/`hero_id` are accepted on `allplayers` entries for enriched sources.
