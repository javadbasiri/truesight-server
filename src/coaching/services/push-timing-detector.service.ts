// src/coaching/services/push-timing-detector.service.ts
import { Injectable } from '@nestjs/common';
import type {
  MessagePriority,
  PushWindow,
} from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import {
  countReadyUltimates,
  getEnemyBuildings,
  getLowHealthTowers,
  hasAnyItemInState,
} from '../utils/team-metrics.js';

/** پنجره‌های پوش و فرصت‌های گرفتن آبجکتیو را تشخیص می‌دهد. */
@Injectable()
export class PushTimingDetectorService {
  private lastItemCompletions = new Map<string, number>();

  public detectPushWindows(state: ProcessedGameState): PushWindow[] {
    const windows = [
      this.detectHeroDeathWindow(state),
      this.detectBuybackWindow(state),
      this.detectPowerSpikeWindow(state),
      this.detectUltimateAdvantage(state),
      this.detectAegisWindow(state),
      this.detectCreepWaveWindow(state),
    ].filter((window): window is PushWindow => window !== null);

    const priorityOrder: Record<MessagePriority, number> = {
      GAME_ENDING: 0,
      CRITICAL: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4,
    };

    return windows.sort(
      (first, second) =>
        priorityOrder[first.priority] - priorityOrder[second.priority],
    );
  }

  public shouldPush(state: ProcessedGameState): boolean {
    return this.detectPushWindows(state).some(
      (window) =>
        window.priority === 'GAME_ENDING' ||
        window.priority === 'CRITICAL' ||
        window.priority === 'HIGH',
    );
  }

  public clear(): void {
    this.lastItemCompletions.clear();
  }

  private detectHeroDeathWindow(state: ProcessedGameState): PushWindow | null {
    const deadEnemies = state.enemies.filter(
      (enemy) => !enemy.alive && enemy.respawnSeconds > 0,
    );

    if (deadEnemies.length < 2) {
      return null;
    }

    const minRespawn = Math.min(
      ...deadEnemies.map((enemy) => enemy.respawnSeconds),
    );
    const deadCores = deadEnemies.filter(
      (enemy) =>
        enemy.netWorth > state.player.netWorth * 0.8 && !enemy.buybackAvailable,
    );

    return {
      type: 'hero_deaths',
      priority: deadCores.length >= 1 ? 'GAME_ENDING' : 'CRITICAL',
      duration: minRespawn,
      message:
        `${deadEnemies.length} نفر از دشمن مرده‌اند` +
        `${deadCores.length > 0 ? ' (کری بدون بای‌بک)' : ''} - همین حالا پوش بده`,
      timestamp: Date.now(),
    };
  }

  private detectBuybackWindow(state: ProcessedGameState): PushWindow | null {
    const deadCoresNoBuyback = state.enemies.filter(
      (enemy) =>
        !enemy.alive &&
        !enemy.buybackAvailable &&
        enemy.netWorth > state.player.netWorth * 0.7 &&
        enemy.respawnSeconds > 30,
    );

    if (deadCoresNoBuyback.length === 0) {
      return null;
    }

    const minRespawn = Math.min(
      ...deadCoresNoBuyback.map((enemy) => enemy.respawnSeconds),
    );

    return {
      type: 'no_buyback',
      priority: 'GAME_ENDING',
      duration: minRespawn,
      message: `کری دشمن مرده و بای‌بک ندارد - پنجره‌ی تمام کردن بازی (${Math.floor(minRespawn)} ثانیه)`,
      timestamp: Date.now(),
    };
  }

  private detectPowerSpikeWindow(state: ProcessedGameState): PushWindow | null {
    const keyItems = [
      'black_king_bar',
      'blink_dagger',
      'desolator',
      'assault_cuirass',
      'refresher_orb',
    ];
    const now = Date.now();

    for (const item of state.items.inventory) {
      const itemName = item.name.toLowerCase();
      const lastCompletion = this.lastItemCompletions.get(itemName) ?? 0;
      if (now - lastCompletion < 30000) {
        continue;
      }

      if (keyItems.some((keyItem) => itemName.includes(keyItem))) {
        this.lastItemCompletions.set(itemName, now);

        return {
          type: 'power_spike',
          priority: 'HIGH',
          duration: 300,
          message: `${item.name} کامل شد - گروه شو و تا اسپایک تازه است پوش بده`,
          timestamp: now,
        };
      }
    }

    if (state.hero.level === 6) {
      const lastLevel6 = this.lastItemCompletions.get('level_6') ?? 0;
      if (now - lastLevel6 > 60000) {
        this.lastItemCompletions.set('level_6', now);

        return {
          type: 'power_spike',
          priority: 'MEDIUM',
          message: 'لول ۶ - آنلتی آماده است، دنبال فایت یا آبجکتیو باش',
          timestamp: now,
        };
      }
    }

    return null;
  }

  private detectUltimateAdvantage(
    state: ProcessedGameState,
  ): PushWindow | null {
    if (countReadyUltimates(state) > 0 && state.team.players.length >= 3) {
      return {
        type: 'ultimate_advantage',
        priority: 'MEDIUM',
        message: 'برتری آنلتی - فایت را فورس کن و آبجکتیو بگیر',
        timestamp: Date.now(),
      };
    }

    return null;
  }

  private detectAegisWindow(state: ProcessedGameState): PushWindow | null {
    if (hasAnyItemInState(state, 'aegis')) {
      return {
        type: 'aegis',
        priority: 'CRITICAL',
        duration: 300,
        message: 'آیجیس داری - قبل از تمام شدنش همین حالا هایگراند برو',
        timestamp: Date.now(),
      };
    }

    if (!state.roshan.alive && state.roshan.respawnTime) {
      const timeUntilRespawn = state.roshan.respawnTime - state.gameTime;
      if (timeUntilRespawn < 60 && timeUntilRespawn > 0) {
        return {
          type: 'aegis',
          priority: 'HIGH',
          message: `روشان ${Math.floor(timeUntilRespawn)} ثانیه دیگر اسپاون می‌شود - آیجیس را بگیر`,
          timestamp: Date.now(),
        };
      }
    }

    return null;
  }

  private detectCreepWaveWindow(state: ProcessedGameState): PushWindow | null {
    const lowTowers = getLowHealthTowers(getEnemyBuildings(state), 30);

    if (lowTowers.length > 0 && state.hero.healthPercent > 50) {
      return {
        type: 'creep_wave',
        priority: 'MEDIUM',
        message: `تاور دشمن ${Math.floor(lowTowers[0].healthPercent)}% جان دارد - با موج بعدی تمامش کن`,
        timestamp: Date.now(),
      };
    }

    return null;
  }
}
