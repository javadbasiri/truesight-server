# System Patterns & Architecture

## Data Flow Pipeline
`Dota 2 Client (HTTP POST /gsi)` -> `GsiController` -> `StateManager / RuleEngineService` -> `CoachGateway (Socket.io)` -> `truesight-client`

## Key Architectural Patterns
1. **Loopback Isolation (`127.0.0.1:4000`):** The NestJS server strictly binds to `127.0.0.1` on port `4000` to bypass VPN virtual adapters (Windscribe, FortiClient) and ensure sub-millisecond local communication with both Dota 2 and the Tauri client.
2. **Idempotent & De-bounced Rules:** Because Dota 2 sends GSI snapshots every ~100ms (`buffer: 0.1`, `throttle: 0.1`), rules must never evaluate statelessly.
   - *Time-based rules* track `lastTriggeredClockTime` so they fire at most once per game second.
   - *State-based rules* use hysteresis/hysteresis locks (e.g., trigger low-mana warning below 25%, reset lock only when mana recovers above 35%) or inventory state diffing.
3. **Fast HTTP Acknowledge:** `POST /gsi` always returns `@HttpCode(200)` immediately so the Dota 2 Source 2 client never drops or throttles the GSI connection.