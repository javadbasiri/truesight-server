# Project Brief: TrueSight Coach Server (`truesight-server`)

## Core Vision
`truesight-server` is the core analytical engine and real-time backend for TrueSight Coach. It ingests high-frequency Dota 2 Game State Integration (GSI) HTTP POST payloads, tracks in-game state transitions, evaluates macro and micro-game coaching rules, and broadcasts actionable alerts via WebSockets to `truesight-client`.

## Primary Objectives
1. **Low-Latency Ingestion:** Process incoming Dota 2 GSI JSON payloads (up to 10 requests/second) with zero blocking and immediate `200 OK` HTTP responses.
2. **Stateful Rule Evaluation (Anti-Spam):** Maintain in-memory match state and cooldowns so alerts trigger strictly once per event or state transition (e.g., item purchase, mana threshold, rune window).
3. **Real-Time WebSocket Delivery:** Push structured `coach-alert` events via Socket.io over local loopback (`127.0.0.1:4000`) to the Tauri overlay.
4. **Scalable SaaS Foundation:** Prepare modular architecture for PostgreSQL + Prisma integration (match history, user profiles, subscription license checks) and external Dota 2 APIs (Stratz/OpenDota).