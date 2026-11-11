// src/coaching/testing/game-state.fixture.ts
import type { GsiPayload } from '../../gsi/interfaces/gsi-payload.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';

/**
 * سازنده‌ی وضعیت بازی برای تست‌ها. مقادیر پیش‌فرض یک مچ سالم در دقیقه ۵ هستند
 * و هر تست می‌تواند بخش‌های مورد نیازش را override کند.
 */
export function createGameState(
  overrides: Partial<ProcessedGameState> = {},
): ProcessedGameState {
  const base: ProcessedGameState = {
    gameTime: 300,
    clockTime: 300,
    gameState: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
    matchId: '1001',
    isDaytime: true,
    player: {
      steamId: '1',
      name: 'Tester',
      kills: 2,
      deaths: 1,
      assists: 3,
      lastHits: 60,
      denies: 4,
      gold: 1500,
      goldReliable: 300,
      goldUnreliable: 1200,
      netWorth: 9000,
      gpm: 500,
      xpm: 600,
      team: 'radiant',
    },
    hero: {
      id: 41,
      name: 'npc_dota_hero_phantom_assassin',
      level: 10,
      x: 0,
      y: 0,
      alive: true,
      respawnSeconds: 0,
      buybackCost: 1200,
      buybackAvailable: true,
      health: 1200,
      maxHealth: 1400,
      healthPercent: 85,
      mana: 400,
      maxMana: 500,
      manaPercent: 80,
      magicImmune: false,
      hasAghanimsScepter: false,
      hasAghanimsShard: false,
    },
    team: {
      players: [],
      netWorth: 12000,
      totalKills: 10,
      totalDeaths: 5,
    },
    enemies: [],
    buildings: {
      radiant: {
        t1: [
          {
            name: 'dota_goodguys_tower1_mid',
            health: 1300,
            maxHealth: 1300,
            healthPercent: 100,
            destroyed: false,
          },
        ],
        t2: [],
        t3: [],
        t4: [],
        barracks: [],
      },
      dire: {
        t1: [
          {
            name: 'dota_badguys_tower1_mid',
            health: 800,
            maxHealth: 1300,
            healthPercent: 61,
            destroyed: false,
          },
        ],
        t2: [],
        t3: [],
        t4: [],
        barracks: [],
      },
    },
    roshan: { alive: false, respawnTime: undefined, aegisHolder: null },
    items: {
      inventory: [
        {
          name: 'item_power_treads',
          slot: 'slot0',
          canCast: false,
          cooldown: 0,
        },
      ],
      stash: [],
      backpack: [],
      allItems: [
        {
          name: 'item_power_treads',
          slot: 'slot0',
          canCast: false,
          cooldown: 0,
        },
      ],
    },
    abilities: {
      ability0: {
        name: 'phantom_strike',
        level: 4,
        canCast: true,
        cooldown: 0,
        cooldownRemaining: 0,
        isUltimate: false,
        ready: true,
      },
      ability3: {
        name: 'coup_de_grace',
        level: 2,
        canCast: true,
        cooldown: 0,
        cooldownRemaining: 0,
        isUltimate: true,
        ready: true,
      },
    },
  };

  return { ...base, ...overrides };
}

/** پکت GSI معتبر برای تست انتها-به-انتها موتور کوچینگ */
export function createGsiPayload(clockTime = 1200): GsiPayload {
  return {
    provider: { name: 'Dota 2', appid: 570, version: 1, timestamp: Date.now() },
    map: {
      name: 'dota',
      matchid: '1001',
      game_time: clockTime,
      clock_time: clockTime,
      daytime: true,
      nightstalker_night: false,
      radiant_score: 10,
      dire_score: 5,
      game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
      paused: false,
      win_team: 'none',
      customgamename: '',
      ward_purchase_cooldown: 0,
    },
    player: {
      steamid: '1',
      name: 'Tester',
      activity: 'playing',
      kills: 2,
      deaths: 1,
      assists: 3,
      last_hits: 200,
      denies: 10,
      kill_streak: 1,
      commands_issued: 100,
      team_name: 'radiant',
      gold: 1500,
      gold_reliable: 300,
      gold_unreliable: 1200,
      gold_from_hero_kills: 200,
      gold_from_creep_kills: 900,
      gold_from_income: 400,
      gold_from_shared: 0,
      gpm: 500,
      xpm: 600,
    },
    hero: {
      xpos: 0,
      ypos: 0,
      id: 41,
      name: 'npc_dota_hero_phantom_assassin',
      level: 10,
      xp: 5000,
      alive: true,
      respawn_seconds: 0,
      buyback_cost: 1200,
      buyback_cooldown: 0,
      health: 1200,
      max_health: 1400,
      health_percent: 85,
      mana: 400,
      max_mana: 500,
      mana_percent: 80,
      silenced: false,
      stunned: false,
      disarmed: false,
      magicimmune: false,
      hexed: false,
      muted: false,
      break: false,
      aghanims_scepter: false,
      aghanims_shard: false,
      smoked: false,
      has_debuff: false,
    },
    abilities: {
      ability0: {
        name: 'phantom_strike',
        level: 4,
        can_cast: true,
        passive: false,
        ability_active: true,
        cooldown: 0,
        ultimate: false,
      },
      ability3: {
        name: 'coup_de_grace',
        level: 2,
        can_cast: true,
        passive: false,
        ability_active: true,
        cooldown: 0,
        ultimate: true,
      },
    },
    items: {
      slot0: {
        name: 'item_power_treads',
        can_cast: false,
        cooldown: 0,
        passive: false,
      },
    },
    buildings: {
      radiant: {
        dota_goodguys_tower1_mid: { health: 1300, max_health: 1300 },
      },
      dire: {
        dota_badguys_tower1_mid: { health: 800, max_health: 1300 },
      },
    },
  };
}
