import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('TrueSight server (e2e)', () => {
  let app: INestApplication<App>;

  const gsiPayload = {
    provider: { name: 'Dota 2', appid: 570, version: 1, timestamp: 1 },
    map: {
      name: 'dota',
      matchid: '4242',
      game_time: 1200,
      clock_time: 1200,
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
    items: {
      slot0: {
        name: 'item_power_treads',
        can_cast: false,
        cooldown: 0,
        passive: false,
      },
    },
    buildings: {
      radiant: { dota_goodguys_tower1_mid: { health: 1300, max_health: 1300 } },
      dire: { dota_badguys_tower1_mid: { health: 800, max_health: 1300 } },
    },
  };

  beforeEach(async () => {
    process.env.GSI_TOKEN = '';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('POST /gsi acknowledges Dota 2 telemetry with 200', () => {
    return request(app.getHttpServer())
      .post('/gsi')
      .send(gsiPayload)
      .expect(200);
  });

  it('exposes the live coaching status', async () => {
    await request(app.getHttpServer())
      .post('/gsi')
      .send(gsiPayload)
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/coach/status')
      .expect(200);

    expect(response.body.inGame).toBe(true);
    expect(response.body.matchId).toBe('4242');
    expect(response.body.gamePhase).toBe('midgame');
  });

  it('returns an empty post-game analysis before the match ends', async () => {
    const response = await request(app.getHttpServer())
      .get('/coach/post-game')
      .expect(200);

    expect(response.body.summary).toBeNull();
    expect(response.body.text).toBeNull();
  });
});
