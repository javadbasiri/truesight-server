import { describe, expect, it } from 'vitest';
import { GameStateProcessorService } from './game-state-processor.service.js';
import { createGsiPayload } from '../testing/game-state.fixture.js';
import type { GsiPayload } from '../../gsi/interfaces/gsi-payload.interface.js';

describe('GameStateProcessorService', () => {
  const processor = new GameStateProcessorService();

  it('returns null when mandatory sections are missing', () => {
    expect(processor.process({} as GsiPayload)).toBeNull();

    const withoutPlayer = createGsiPayload();
    delete withoutPlayer.player;
    expect(processor.process(withoutPlayer)).toBeNull();
  });

  it('normalizes player, hero and abilities', () => {
    const state = processor.process(createGsiPayload(720));

    expect(state).not.toBeNull();
    expect(state!.player.team).toBe('radiant');
    expect(state!.player.lastHits).toBe(200);
    expect(state!.hero.name).toBe('npc_dota_hero_phantom_assassin');
    expect(state!.hero.buybackAvailable).toBe(true);
    expect(state!.abilities.ability3.isUltimate).toBe(true);
    expect(state!.abilities.ability3.ready).toBe(true);
  });

  it('filters empty items and keeps only real inventory items', () => {
    const payload = createGsiPayload();
    payload.items = {
      slot0: {
        name: 'item_blink',
        can_cast: true,
        cooldown: 0,
        passive: false,
      },
      slot1: { name: 'empty', can_cast: false, cooldown: 0, passive: true },
      stash0: {
        name: 'item_tpscroll',
        can_cast: true,
        cooldown: 0,
        passive: false,
      },
      backpack0: {
        name: 'item_clarity',
        can_cast: true,
        cooldown: 0,
        passive: false,
      },
    };

    const state = processor.process(payload)!;

    expect(state.items.inventory.map((item) => item.name)).toEqual([
      'item_blink',
    ]);
    expect(state.items.stash.map((item) => item.name)).toEqual([
      'item_tpscroll',
    ]);
    expect(state.items.backpack.map((item) => item.name)).toEqual([
      'item_clarity',
    ]);
    expect(state.items.allItems).toHaveLength(3);
  });

  it('categorizes buildings by tier and ancient', () => {
    const payload = createGsiPayload();
    payload.buildings = {
      radiant: {
        dota_goodguys_fort: { health: 4500, max_health: 4500 },
        dota_goodguys_tower3_mid: { health: 0, max_health: 1600 },
        dota_goodguys_melee_rax_mid: { health: 2200, max_health: 2200 },
      },
      dire: {
        dota_badguys_tower2_top: { health: 1200, max_health: 1600 },
      },
    };

    const state = processor.process(payload)!;

    expect(state.buildings.radiant.ancient?.name).toBe('dota_goodguys_fort');
    expect(state.buildings.radiant.t3?.[0].destroyed).toBe(true);
    expect(state.buildings.radiant.barracks).toHaveLength(1);
    expect(state.buildings.dire.t2?.[0].healthPercent).toBe(75);
  });

  it('splits teams and enemies using the allplayers section', () => {
    const payload = createGsiPayload();
    payload.allplayers = [
      {
        steamid: '1',
        name: 'Tester',
        kills: 2,
        deaths: 1,
        assists: 3,
        last_hits: 200,
        denies: 10,
        team_name: 'radiant',
        gold: 1500,
      },
      {
        steamid: '2',
        name: 'Mate',
        kills: 1,
        deaths: 2,
        assists: 4,
        last_hits: 120,
        denies: 2,
        team_name: 'radiant',
        gold: 900,
      },
      {
        steamid: '3',
        name: 'Enemy',
        kills: 5,
        deaths: 3,
        assists: 1,
        last_hits: 180,
        denies: 5,
        team_name: 'dire',
        gold: 2100,
        respawn_seconds: 0,
        buyback_cooldown: 0,
        position: [10, 20],
        hero_name: 'npc_dota_hero_sven',
      },
    ];

    const state = processor.process(payload)!;

    expect(state.team.players).toHaveLength(2);
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0].heroName).toBe('npc_dota_hero_sven');
    expect(state.enemies[0].visible).toBe(true);
    expect(state.enemies[0].buybackAvailable).toBe(true);
    expect(processor.hasEnemyRoster(state)).toBe(false);
  });

  it('reads the roshan respawn timer from the map section', () => {
    const payload = createGsiPayload();
    payload.map!.roshan_state = 'respawn_timer';
    payload.map!.roshan_state_end_seconds = 1300;

    const state = processor.process(payload)!;

    expect(state.roshan.alive).toBe(false);
    expect(state.roshan.respawnTime).toBe(1300);
  });
});
