// src/gsi.controller.ts
import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { RuleEngineService } from './gsi/interfaces/rule-engine.service.js';
import { CoachingEngineService } from './coaching/services/coaching-engine.service.js';
import {
  type GameStatePayload,
  type GsiPayload,
} from './gsi/interfaces/gsi-payload.interface.js';
import { CoachGateway } from './coach.gateway.js';

/** حداقل فاصله‌ی ارسال وضعیت بازی به داشبورد (GSI حدود ۱۰ پکت در ثانیه می‌فرستد) */
const GAME_STATE_THROTTLE_MS = 500;

@Controller('gsi')
export class GsiController {
  private lastGameStateEmit = 0;

  constructor(
    private readonly ruleEngineService: RuleEngineService,
    private readonly coachGateway: CoachGateway,
    private readonly coachingEngineService: CoachingEngineService,
  ) {}

  @Post()
  @HttpCode(200)
  handleGsiData(@Body() payload: GsiPayload): void {
    this.ruleEngineService.processGsiTick(payload);
    this.coachingEngineService.processTick(payload);

    const now = Date.now();
    if (now - this.lastGameStateEmit >= GAME_STATE_THROTTLE_MS) {
      this.lastGameStateEmit = now;
      this.coachGateway.sendGameState(this.toGameStatePayload(payload));
    }
  }

  private toGameStatePayload(payload: GsiPayload): GameStatePayload {
    const { map, player, hero } = payload;

    return {
      gameState: map?.game_state ?? 'DOTA_GAMERULES_STATE_INIT',
      clockTime: map?.clock_time ?? 0,
      radiantScore: map?.radiant_score ?? 0,
      direScore: map?.dire_score ?? 0,
      paused: map?.paused ?? false,
      player: player
        ? {
            name: player.name,
            team: player.team_name,
            kills: player.kills ?? 0,
            deaths: player.deaths ?? 0,
            assists: player.assists ?? 0,
            lastHits: player.last_hits ?? 0,
            denies: player.denies ?? 0,
            gpm: player.gpm ?? 0,
            xpm: player.xpm ?? 0,
            gold: player.gold ?? 0,
          }
        : undefined,
      hero: hero
        ? {
            name: hero.name,
            level: hero.level ?? 0,
            alive: hero.alive ?? false,
            respawnSeconds: hero.respawn_seconds ?? 0,
            healthPercent: hero.health_percent ?? 0,
            manaPercent: hero.mana_percent ?? 0,
          }
        : undefined,
    };
  }
}
