// src/coaching/services/game-state-processor.service.ts
import { Injectable } from '@nestjs/common';
import type {
  GsiAllPlayer,
  GsiPayload,
} from '../../gsi/interfaces/gsi-payload.interface.js';
import type {
  ProcessedAbilities,
  ProcessedAbility,
  ProcessedBuilding,
  ProcessedBuildingSet,
  ProcessedBuildings,
  ProcessedEnemy,
  ProcessedGameState,
  ProcessedHero,
  ProcessedItems,
  ProcessedPlayer,
  ProcessedTeam,
  ProcessedTeamSide,
} from '../../gsi/interfaces/processed-game-state.interface.js';

/**
 * پکت خام و پرنویز GSI را به یک ساختار تمیز و type-safe تبدیل می‌کند.
 * تمام فیلدهای optional با مقادیر امن جایگزین می‌شوند تا موتور کوچینگ
 * در منو، اسپکتیت یا هنگام قطع اتصال کرش نکند.
 */
@Injectable()
export class GameStateProcessorService {
  public process(payload: GsiPayload): ProcessedGameState | null {
    if (!payload.map || !payload.player) {
      return null;
    }

    const player = this.processPlayer(payload);
    const hero = this.processHero(payload);

    return {
      gameTime: payload.map.game_time ?? 0,
      clockTime: payload.map.clock_time ?? 0,
      gameState: payload.map.game_state ?? 'UNKNOWN',
      matchId: payload.map.matchid ?? '',
      isDaytime: payload.map.daytime !== false,
      player,
      hero,
      team: this.processTeam(payload, player),
      enemies: this.processEnemies(payload, player.team),
      buildings: this.processBuildings(payload),
      roshan: this.processRoshan(payload),
      items: this.processItems(payload),
      abilities: this.processAbilities(payload),
    };
  }

  /**
   * آیا داده‌ی کافی از ترکیب تیمی دشمن داریم؟ (بدون allplayers، تحلیل
   * ارزش خالص و وضعیت Buyback دشمن قابل اتکا نیست.)
   */
  public hasEnemyRoster(state: ProcessedGameState): boolean {
    return state.enemies.length >= 4;
  }

  private processPlayer(payload: GsiPayload): ProcessedPlayer {
    const player = payload.player!;

    return {
      steamId: player.steamid ?? '',
      name: player.name ?? 'Unknown',
      kills: player.kills ?? 0,
      deaths: player.deaths ?? 0,
      assists: player.assists ?? 0,
      lastHits: player.last_hits ?? 0,
      denies: player.denies ?? 0,
      gold: player.gold ?? 0,
      goldReliable: player.gold_reliable ?? 0,
      goldUnreliable: player.gold_unreliable ?? 0,
      netWorth: player.net_worth ?? player.gold ?? 0,
      gpm: player.gpm ?? 0,
      xpm: player.xpm ?? 0,
      team: this.normalizeTeam(player.team_name),
    };
  }

  private processHero(payload: GsiPayload): ProcessedHero {
    const hero = payload.hero;

    return {
      id: hero?.id ?? 0,
      name: hero?.name ?? 'unknown',
      level: hero?.level ?? 1,
      x: hero?.xpos ?? 0,
      y: hero?.ypos ?? 0,
      alive: hero ? hero.alive !== false : false,
      respawnSeconds: hero?.respawn_seconds ?? 0,
      buybackCost: hero?.buyback_cost ?? 0,
      buybackAvailable: (hero?.buyback_cooldown ?? 1) === 0,
      health: hero?.health ?? 0,
      maxHealth: hero?.max_health ?? 0,
      healthPercent: hero?.health_percent ?? 0,
      mana: hero?.mana ?? 0,
      maxMana: hero?.max_mana ?? 0,
      manaPercent: hero?.mana_percent ?? 0,
      magicImmune: hero?.magicimmune === true,
      hasAghanimsScepter: hero?.aghanims_scepter === true,
      hasAghanimsShard: hero?.aghanims_shard === true,
    };
  }

  private processTeam(
    payload: GsiPayload,
    player: ProcessedPlayer,
  ): ProcessedTeam {
    const roster = payload.allplayers ?? [];
    const teammates = roster
      .filter((entry) => this.normalizeTeam(entry.team_name) === player.team)
      .map((entry) => this.mapRosterPlayer(entry));

    const players = teammates.length > 0 ? teammates : [player];

    return {
      players,
      netWorth: players.reduce((sum, entry) => sum + entry.netWorth, 0),
      totalKills: players.reduce((sum, entry) => sum + entry.kills, 0),
      totalDeaths: players.reduce((sum, entry) => sum + entry.deaths, 0),
    };
  }

  private processEnemies(
    payload: GsiPayload,
    playerTeam: ProcessedTeamSide,
  ): ProcessedEnemy[] {
    const roster = payload.allplayers ?? [];
    const enemyTeam: ProcessedTeamSide =
      playerTeam === 'radiant' ? 'dire' : 'radiant';

    return roster
      .filter((entry) => this.normalizeTeam(entry.team_name) === enemyTeam)
      .map((entry) => ({
        steamId: entry.steamid ?? '',
        name: entry.name ?? 'Unknown',
        heroId: entry.hero_id,
        heroName: entry.hero_name,
        level: undefined,
        alive: (entry.respawn_seconds ?? 0) === 0,
        respawnSeconds: entry.respawn_seconds ?? 0,
        buybackAvailable: (entry.buyback_cooldown ?? 1) === 0,
        buybackCost: entry.buyback_cost ?? 0,
        position: entry.position,
        visible: entry.position !== undefined,
        kills: entry.kills ?? 0,
        deaths: entry.deaths ?? 0,
        netWorth: entry.net_worth ?? entry.gold ?? 0,
      }));
  }

  private mapRosterPlayer(entry: GsiAllPlayer): ProcessedPlayer {
    return {
      steamId: entry.steamid ?? '',
      name: entry.name ?? 'Unknown',
      kills: entry.kills ?? 0,
      deaths: entry.deaths ?? 0,
      assists: entry.assists ?? 0,
      lastHits: entry.last_hits ?? 0,
      denies: entry.denies ?? 0,
      gold: entry.gold ?? 0,
      goldReliable: entry.gold_reliable ?? 0,
      goldUnreliable: entry.gold_unreliable ?? 0,
      netWorth: entry.net_worth ?? entry.gold ?? 0,
      gpm: entry.gpm ?? 0,
      xpm: entry.xpm ?? 0,
      team: this.normalizeTeam(entry.team_name),
    };
  }

  private processBuildings(payload: GsiPayload): ProcessedBuildings {
    return {
      radiant: this.processBuildingSet(payload.buildings?.radiant),
      dire: this.processBuildingSet(payload.buildings?.dire),
    };
  }

  private processBuildingSet(
    buildingSet:
      Record<string, { health: number; max_health: number }> | undefined,
  ): ProcessedBuildingSet {
    const processed: ProcessedBuildingSet = {
      t4: [],
      t3: [],
      t2: [],
      t1: [],
      barracks: [],
    };

    if (!buildingSet) {
      return processed;
    }

    for (const [key, building] of Object.entries(buildingSet)) {
      const health = building?.health ?? 0;
      const maxHealth = building?.max_health ?? 0;
      const entry: ProcessedBuilding = {
        name: key,
        health,
        maxHealth,
        healthPercent: maxHealth > 0 ? (health / maxHealth) * 100 : 0,
        destroyed: health === 0,
      };

      if (key.includes('fort') || key.includes('ancient')) {
        processed.ancient = entry;
      } else if (key.includes('tower4') || key.includes('t4')) {
        processed.t4!.push(entry);
      } else if (key.includes('tower3') || key.includes('t3')) {
        processed.t3!.push(entry);
      } else if (key.includes('tower2') || key.includes('t2')) {
        processed.t2!.push(entry);
      } else if (key.includes('tower1') || key.includes('t1')) {
        processed.t1!.push(entry);
      } else if (key.includes('rax') || key.includes('barracks')) {
        processed.barracks!.push(entry);
      }
    }

    return processed;
  }

  private processRoshan(payload: GsiPayload) {
    const roshanState = payload.map?.roshan_state ?? '';
    const endSeconds = payload.map?.roshan_state_end_seconds ?? 0;

    return {
      alive: roshanState === 'alive',
      respawnTime: roshanState === 'respawn_timer' ? endSeconds : undefined,
      aegisHolder: null,
    };
  }

  private processItems(payload: GsiPayload): ProcessedItems {
    const inventory: ProcessedItems['inventory'] = [];
    const stash: ProcessedItems['stash'] = [];
    const backpack: ProcessedItems['backpack'] = [];

    for (const [slot, item] of Object.entries(payload.items ?? {})) {
      if (!item || item.name === 'empty') {
        continue;
      }

      const processed = {
        name: item.name,
        slot,
        canCast: item.can_cast === true,
        cooldown: item.cooldown ?? 0,
        charges: item.charges ?? item.item_charges,
      };

      if (slot.startsWith('slot')) {
        inventory.push(processed);
      } else if (slot.startsWith('stash')) {
        stash.push(processed);
      } else if (slot.startsWith('backpack')) {
        backpack.push(processed);
      }
    }

    return {
      inventory,
      stash,
      backpack,
      allItems: [...inventory, ...stash, ...backpack],
    };
  }

  private processAbilities(payload: GsiPayload): ProcessedAbilities {
    const processed: ProcessedAbilities = {};

    for (const [key, ability] of Object.entries(payload.abilities ?? {})) {
      if (!ability) {
        continue;
      }

      const entry: ProcessedAbility = {
        name: ability.name ?? key,
        level: ability.level ?? 0,
        canCast: ability.can_cast === true,
        cooldown: ability.cooldown ?? 0,
        cooldownRemaining: ability.cooldown ?? 0,
        isUltimate: ability.ultimate === true,
        ready: (ability.cooldown ?? 0) === 0 && ability.can_cast === true,
      };

      processed[key] = entry;
    }

    return processed;
  }

  private normalizeTeam(team: string | undefined): ProcessedTeamSide {
    return team?.toLowerCase() === 'dire' ? 'dire' : 'radiant';
  }
}
