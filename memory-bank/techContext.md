# Technical Context

## Backend Stack
- **Framework:** NestJS (Node.js / TypeScript)
- **WebSockets:** `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`
- **Database (Planned):** PostgreSQL with Prisma ORM
- **In-Memory State / Caching:** Native TypeScript Map/State services (upgradable to Redis)

## Dota 2 GSI Integration Specs
- **Config File:** `Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\gamestate_integration_truesight.cfg`
- **Steam Launch Option:** `-gamestateintegration`
- **Target Endpoint:** `http://127.0.0.1:4000/gsi`
- **Active GSI Sections:** `provider`, `map`, `player`, `hero`, `abilities`, `items`, `events`, `buildings`.