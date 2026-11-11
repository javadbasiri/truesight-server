# Product Context: TrueSight Coach Server

## Role in the Ecosystem
While `truesight-client` is a lightweight visual/audio renderer, `truesight-server` acts as the "Brain" of the coach. Raw GSI data is noisy and repetitive; the server transforms raw telemetry into concise, high-impact Persian coaching callouts tailored to the player's hero, role, and game clock.

## Core Coaching Logic Domains
- **Clock-Driven Macro Timings:** Water Runes (1:45, 3:45), Power Runes (every 2m from 5:45), Wisdom Runes (every 7m), Camp Stacking (second :45), Lotus Pool, and Day/Night vision transitions.
- **State-Diff & Resource Management:** Low mana/HP warnings, unspent reliable gold before fights, Buyback status tracking, and item cooldown reminders (e.g., BKB, Smoke, Blink).
- **Power Spikes & Itemization:** Detecting newly completed core items in the hero inventory and prompting immediate map rotations or smoke plays.

## Alert Payload Contract
Every emitted Socket.io event (`coach-alert`) adheres to:
- `id`: Unique string identifier (used by client for deduplication/queueing).
- `message`: Concise, actionable Persian text.
- `type`: `'info' | 'warning' | 'spike'`.