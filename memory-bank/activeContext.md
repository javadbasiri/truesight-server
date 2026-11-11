# Active Context

## Current Focus
The backend coaching logic has been decoupled from `GsiController` into a strongly-typed `RuleEngineService`. The server now evaluates macro timers, hero resource thresholds, late-game buyback status, and slot-agnostic item power spikes while emitting structured `CoachAlertPayload` events (including `audioKey` identifiers) to `truesight-client`.

## Recent Milestones Achieved
- Created comprehensive TypeScript interfaces (`src/gsi/interfaces/gsi-payload.interface.ts`) covering `GsiPayload`, `GsiMap`, `GsiPlayer`, `GsiHero`, `GsiAbilities`, `GsiItems`, `GsiBuildings`, and `CoachAlertPayload`.
- Refactored `GsiController` into a thin HTTP ingestion layer delegating all telemetry processing to `RuleEngineService`.
- Implemented `checkAndResetMatchState` in `RuleEngineService` to automatically clear state locks and item sets when a new `matchid` begins or when the game clock rewinds in Demo Hero mode.
- Expanded macro timers: Water Runes (1:45, 3:45), First Night warning (4:45), Power Runes (every 2m), Wisdom Runes (every 7m), Lotus Pool (every 3m up to 15m), and Camp Stacking (second :45).
- Implemented state-based hero checks with hysteresis locks: Low Mana (under 25%, reset at 35%), Low HP (under 25%, reset at 45%), and Late-Game Buyback Gold warning (25m+).
- Built slot-agnostic Inventory Power Spike detection (`notifiedItems` Set) for 10 core items (`item_bottle`, `item_blink`, `item_black_king_bar`, `item_orchid`, `item_witch_blade`, `item_kaya_and_sange`, `item_aghanims_scepter`, `item_desolator`, `item_manta`, `item_sphere`).

## Next Immediate Steps
1. Implement the Alert Queue and Audio Engine in `truesight-client` to consume the new `audioKey` field and prioritize `warning` / `spike` alerts over `info` timers.
2. Add Bottle rune tracking (`contains_rune`) and key ability/ultimate cooldown evaluators to `RuleEngineService`.
3. Design hero-specific midlane coaching profiles (e.g., specialized timings and item spikes for Shadow Fiend, Puck, Lina, Queen of Pain, Void Spirit, and Templar Assassin).