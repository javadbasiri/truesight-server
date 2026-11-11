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

## What's Left to Build (Backlog)
- [ ] **Bottle & Ability Tracking:** Alert when a bottled rune is about to expire (2-minute timer) or when Ultimate / BKB comes off cooldown.
- [ ] **Midlane Hero Profiles:** Custom rule modules tailored to specific hero mechanics and power spikes.
- [ ] **Additional Objective Timers:** Tormentor spawn window (20:00) and Roshan respawn estimation based on game events.
- [ ] **Sub-Service Refactoring:** Split `RuleEngineService` into dedicated domain evaluators (`MacroTimerEvaluator`, `ResourceEvaluator`, `ItemSpikeEvaluator`) as rule count scales.
- [ ] **Database & SaaS Layer:** Prisma + PostgreSQL integration for match telemetry logging and user license validation.

## Known Issues / Edge Cases
- Buying, selling, and re-buying the exact same core item in a single match will only trigger the spike alert once due to the `notifiedItems` Set (acceptable behavior for standard matches).