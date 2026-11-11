// src/coaching/services/item-build-advisor.service.ts
import { Injectable } from '@nestjs/common';
import type { CoachingAdvice } from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import { getInventoryItemNames, hasItem } from '../utils/team-metrics.js';

/**
 * مشاور آیتم: بر اساس هیرو، وضعیت بازی و گلد فعلی آیتم بعدی را پیشنهاد می‌دهد.
 */
@Injectable()
export class ItemBuildAdvisorService {
  private readonly coreItems: Record<string, string[]> = {
    npc_dota_hero_antimage: ['power_treads', 'battle_fury', 'manta', 'abyssal'],
    npc_dota_hero_juggernaut: ['power_treads', 'maelstrom', 'manta', 'basher'],
    npc_dota_hero_phantom_assassin: [
      'power_treads',
      'battle_fury',
      'desolator',
      'black_king_bar',
    ],
    npc_dota_hero_slark: ['power_treads', 'invis_sword', 'basher', 'abyssal'],
    npc_dota_hero_spectre: ['power_treads', 'radiance', 'manta', 'skadi'],
    npc_dota_hero_terrorblade: ['power_treads', 'manta', 'skadi', 'butterfly'],
    npc_dota_hero_medusa: ['power_treads', 'manta', 'skadi', 'butterfly'],
    npc_dota_hero_invoker: [
      'power_treads',
      'aether_lens',
      'octarine',
      'refresher',
    ],
    npc_dota_hero_puck: ['power_treads', 'blink', 'cyclone', 'dagon'],
    npc_dota_hero_storm_spirit: [
      'power_treads',
      'orchid',
      'bloodstone',
      'sheepstick',
    ],
    npc_dota_hero_queenofpain: [
      'power_treads',
      'orchid',
      'blink',
      'sheepstick',
    ],
    npc_dota_hero_tinker: ['soul_ring', 'travel_boots', 'blink', 'dagon'],
    npc_dota_hero_centaur: ['tranquil_boots', 'blink', 'blade_mail', 'heart'],
    npc_dota_hero_axe: ['tranquil_boots', 'blink', 'blade_mail', 'heart'],
    npc_dota_hero_tidehunter: ['arcane_boots', 'blink', 'refresher', 'shivas'],
    npc_dota_hero_dark_seer: ['soul_ring', 'blink', 'refresher', 'shivas'],
    npc_dota_hero_crystal_maiden: [
      'tranquil_boots',
      'glimmer',
      'force_staff',
      'aether_lens',
    ],
    npc_dota_hero_lion: [
      'tranquil_boots',
      'blink',
      'aether_lens',
      'sheepstick',
    ],
    npc_dota_hero_shadow_shaman: [
      'arcane_boots',
      'blink',
      'refresher',
      'sheepstick',
    ],
    npc_dota_hero_witch_doctor: [
      'tranquil_boots',
      'glimmer',
      'ultimate_scepter',
      'refresher',
    ],
  };

  private readonly itemCosts: Record<string, number> = {
    power_treads: 1400,
    phase_boots: 1500,
    arcane_boots: 1300,
    tranquil_boots: 925,
    blink_dagger: 2250,
    battle_fury: 4100,
    manta_style: 4600,
    black_king_bar: 3975,
    desolator: 3500,
    skull_basher: 2875,
    abyssal_blade: 6250,
    radiance: 5050,
    skadi: 5500,
    butterfly: 5450,
    assault_cuirass: 5125,
    refresher_orb: 5000,
    scythe_of_vyse: 5675,
    orchid_malevolence: 3475,
    bloodstone: 4600,
    boots_of_travel: 2500,
    force_staff: 2200,
    glimmer_cape: 1950,
    aether_lens: 2275,
    aghs_scepter: 4200,
  };

  private readonly itemTimings: Record<string, number> = {
    power_treads: 300,
    phase_boots: 300,
    blink_dagger: 600,
    battle_fury: 900,
    black_king_bar: 1200,
    manta_style: 1500,
  };

  public getRecommendations(state: ProcessedGameState): CoachingAdvice | null {
    const heroName = state.hero.name;
    const currentItems = getInventoryItemNames(state);
    const gold = state.player.gold;
    const gameTime = state.gameTime;

    const coreItems = this.coreItems[heroName];
    if (coreItems) {
      const missingCore = coreItems.find(
        (item) => !hasItem(currentItems, item),
      );
      if (missingCore) {
        const itemCost = this.getItemCost(missingCore);
        const canAfford = gold >= itemCost * 0.8;

        if (canAfford || this.isGoodTiming(gameTime, missingCore)) {
          return {
            priority: 'MEDIUM',
            message: `آیتم بعدی: ${this.formatItemName(missingCore)} - ${this.getItemReason(missingCore)}`,
            action: 'item_build',
            timestamp: Date.now(),
            gameTime,
          };
        }
      }
    }

    return (
      this.checkSituationalItems(state, currentItems, gold) ??
      this.checkUpgrades(state, currentItems, gold) ??
      this.checkConsumables(state, currentItems, gold)
    );
  }

  private checkSituationalItems(
    state: ProcessedGameState,
    currentItems: string[],
    gold: number,
  ): CoachingAdvice | null {
    const hasInvisEnemy = state.enemies.some((enemy) =>
      ['riki', 'clinkz', 'bounty_hunter'].some((name) =>
        (enemy.heroName ?? '').toLowerCase().includes(name),
      ),
    );

    if (
      hasInvisEnemy &&
      !hasItem(currentItems, 'gem') &&
      !hasItem(currentItems, 'sentry')
    ) {
      return {
        priority: 'MEDIUM',
        message: 'دشمن هیروی اینویز دارد - دتکشن بخر (سنتری یا جم)',
        action: 'item_build',
        timestamp: Date.now(),
        gameTime: state.gameTime,
      };
    }

    const magicThreats = state.enemies.filter(
      (enemy) =>
        (enemy.level ?? 0) > 10 && !hasItem(currentItems, 'black_king_bar'),
    );

    if (magicThreats.length >= 3 && state.gameTime > 1200 && gold > 3975) {
      return {
        priority: 'HIGH',
        message: 'دشمن دمیج جادویی زیاد دارد - به زودی BKB ببند',
        action: 'item_build',
        timestamp: Date.now(),
        gameTime: state.gameTime,
      };
    }

    return null;
  }

  private checkUpgrades(
    state: ProcessedGameState,
    currentItems: string[],
    gold: number,
  ): CoachingAdvice | null {
    const upgrades: Record<string, { from: string[]; cost: number }> = {
      power_treads: { from: ['boots'], cost: 1400 },
      phase_boots: { from: ['boots'], cost: 1500 },
      arcane_boots: { from: ['boots'], cost: 1300 },
      tranquil_boots: { from: ['boots'], cost: 925 },
      blink_dagger: { from: [], cost: 2250 },
      force_staff: { from: [], cost: 2200 },
    };

    for (const [itemName, upgrade] of Object.entries(upgrades)) {
      if (
        !hasItem(currentItems, upgrade.from) ||
        hasItem(currentItems, itemName)
      ) {
        continue;
      }

      if (gold >= upgrade.cost * 0.9) {
        return {
          priority: 'MEDIUM',
          message: `ارتقا ممکن است: ${this.formatItemName(itemName)} - موبیلیتی و یوتیلیتی خوبی می‌دهد`,
          action: 'item_build',
          timestamp: Date.now(),
          gameTime: state.gameTime,
        };
      }
    }

    return null;
  }

  private checkConsumables(
    state: ProcessedGameState,
    currentItems: string[],
    gold: number,
  ): CoachingAdvice | null {
    const { healthPercent, manaPercent, level } = state.hero;

    if (!hasItem(currentItems, ['tpscroll', 'tp_scroll']) && gold > 50) {
      return {
        priority: 'LOW',
        message: 'TP بخر - برای چرخش روی مپ ضروری است',
        action: 'item_build',
        timestamp: Date.now(),
        gameTime: state.gameTime,
      };
    }

    if (
      healthPercent < 30 &&
      !hasItem(currentItems, ['tango', 'flask', 'salve', 'tango_single']) &&
      gold > 90
    ) {
      return {
        priority: 'MEDIUM',
        message: 'جان کم داری - ریجن بخر (تانگو یا سالو)',
        action: 'item_build',
        timestamp: Date.now(),
        gameTime: state.gameTime,
      };
    }

    if (
      manaPercent < 20 &&
      level > 3 &&
      gold > 50 &&
      !hasItem(currentItems, 'clarity')
    ) {
      return {
        priority: 'LOW',
        message: 'مانا کم داری - کلریتی بخر تا بتوانی اسپل بزنی',
        action: 'item_build',
        timestamp: Date.now(),
        gameTime: state.gameTime,
      };
    }

    return null;
  }

  private getItemCost(itemName: string): number {
    return this.itemCosts[itemName] ?? 2000;
  }

  private isGoodTiming(gameTime: number, itemName: string): boolean {
    const expectedTime = this.itemTimings[itemName] ?? 0;
    if (expectedTime === 0) {
      return false;
    }

    return gameTime >= expectedTime * 0.8 && gameTime <= expectedTime * 1.5;
  }

  private getItemReason(itemName: string): string {
    const reasons: Record<string, string> = {
      black_king_bar: 'برای فایت‌های جادویی و پوش ایمن',
      blink: 'برای اینیشیشن و پیک‌آف',
      blink_dagger: 'برای اینیشیشن و پیک‌آف',
      battle_fury: 'برای سرعت فارم',
      radiance: 'برای فارم و فشار روی مپ',
      manta: 'برای دیسپل و پوش لین',
      manta_style: 'برای دیسپل و پوش لین',
      desolator: 'برای زدن سریع ساختمان',
      skadi: 'برای فایت اواخر بازی',
    };

    return reasons[itemName] ?? 'برای پاور اسپایک بعدی تیم';
  }

  private formatItemName(itemName: string): string {
    return itemName
      .replace(/^item_/, '')
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
