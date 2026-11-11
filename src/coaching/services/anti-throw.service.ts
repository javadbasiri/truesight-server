// src/coaching/services/anti-throw.service.ts
import { Injectable } from '@nestjs/common';
import type { CoachingAdvice } from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import {
  countAliveEnemies,
  countDeadEnemies,
  getEnemyBuildings,
  getEnemyNetWorth,
  getTowers,
  hasAnyItemInState,
} from '../utils/team-metrics.js';

/**
 * سیستم ضد ترو (Anti-Throw): رایج‌ترین سناریوهایی که باعث باختن
 * بازی برده می‌شوند را تشخیص می‌دهد و هشدار می‌دهد.
 */
@Injectable()
export class AntiThrowService {
  private lastRoshWarning = 0;
  private lastWarningByType = new Map<string, number>();
  private readonly roshWarningCooldown = 120000;
  private readonly genericCooldown = 45000;

  public checkThrowScenarios(state: ProcessedGameState): CoachingAdvice | null {
    return (
      this.checkChasingKills(state) ??
      this.checkBackAfterObjective(state) ??
      this.checkRoshWithoutVision(state) ??
      this.checkBuybackUsage(state) ??
      this.checkOverFarming(state) ??
      this.checkFightingWithoutAbilities(state)
    );
  }

  public clear(): void {
    this.lastRoshWarning = 0;
    this.lastWarningByType.clear();
  }

  private checkChasingKills(state: ProcessedGameState): CoachingAdvice | null {
    const recentlyDeadEnemies = state.enemies.some(
      (enemy) => !enemy.alive && enemy.respawnSeconds < 20,
    );

    if (
      state.hero.healthPercent >= 40 ||
      !state.hero.alive ||
      !recentlyDeadEnemies
    ) {
      return null;
    }

    return this.buildAdvice(state, 'chasing', {
      priority: 'HIGH',
      message: 'دنبال کیل در فوگ نرو - تاور بزن، کیل ارزش باختن بازی را ندارد',
      action: 'retreat',
    });
  }

  private checkBackAfterObjective(
    state: ProcessedGameState,
  ): CoachingAdvice | null {
    if (
      state.hero.healthPercent >= 30 ||
      !state.hero.alive ||
      state.player.kills === 0
    ) {
      return null;
    }

    return this.buildAdvice(state, 'back_after_objective', {
      priority: 'HIGH',
      message: 'بعد از آبجکتیو جان کم داری - برگرد و هیل کن، برتری را ترو نکن',
      action: 'retreat',
    });
  }

  private checkRoshWithoutVision(
    state: ProcessedGameState,
  ): CoachingAdvice | null {
    const now = Date.now();
    if (now - this.lastRoshWarning < this.roshWarningCooldown) {
      return null;
    }

    const hasVision = hasAnyItemInState(state, ['ward', 'gem', 'sentry']);

    if (
      state.gameTime <= 1200 ||
      !state.hero.alive ||
      !state.roshan.alive ||
      countDeadEnemies(state) < 2 ||
      countAliveEnemies(state) > 2 ||
      hasVision
    ) {
      return null;
    }

    this.lastRoshWarning = now;

    return {
      priority: 'CRITICAL',
      message:
        'روشان نرو - دید نداری، این دقیقاً همان‌جایی است که بازی را ترو می‌کنی. اول وارد بگذار',
      action: 'ward',
      timestamp: now,
      gameTime: state.gameTime,
    };
  }

  private checkBuybackUsage(state: ProcessedGameState): CoachingAdvice | null {
    if (
      state.gameTime <= 2400 ||
      !state.hero.buybackAvailable ||
      this.isDefendingBase(state)
    ) {
      return null;
    }

    return this.buildAdvice(state, 'save_buyback', {
      priority: 'MEDIUM',
      message:
        'بای‌بک را نگه دار - فقط برای دفاع از Ancient یا تمام کردن بازی استفاده کن',
      action: 'save_buyback',
    });
  }

  private checkOverFarming(state: ProcessedGameState): CoachingAdvice | null {
    if (state.enemies.length < 4) {
      return null;
    }

    const advantage = state.team.netWorth - getEnemyNetWorth(state);

    if (advantage <= 8000 || !state.hero.alive || state.player.lastHits <= 0) {
      return null;
    }

    if (!this.shouldBePushing(state)) {
      return null;
    }

    return this.buildAdvice(state, 'stop_farming', {
      priority: 'CRITICAL',
      message:
        'فارم را قطع کن - تیم ۸ هزار گلد جلوست، گروه شو و بازی را تمام کن',
      action: 'group',
    });
  }

  private checkFightingWithoutAbilities(
    state: ProcessedGameState,
  ): CoachingAdvice | null {
    const ultimates = Object.values(state.abilities).filter(
      (ability) => ability.isUltimate,
    );
    const ultsOnCooldown = ultimates.filter((ability) => !ability.ready).length;

    const enemyNearby = state.enemies.some(
      (enemy) => enemy.alive && enemy.visible,
    );

    if (
      ultsOnCooldown === 0 ||
      !enemyNearby ||
      state.hero.healthPercent <= 50
    ) {
      return null;
    }

    return this.buildAdvice(state, 'ult_cooldown', {
      priority: 'MEDIUM',
      message:
        'آنلتی روی کول‌داون است - فایت را فورس نکن، منتظر آماده شدنش بمان',
      action: 'wait',
    });
  }

  private buildAdvice(
    state: ProcessedGameState,
    type: string,
    payload: Pick<CoachingAdvice, 'priority' | 'message' | 'action'>,
  ): CoachingAdvice | null {
    const now = Date.now();
    const lastWarning = this.lastWarningByType.get(type) ?? 0;
    if (now - lastWarning < this.genericCooldown) {
      return null;
    }

    this.lastWarningByType.set(type, now);

    return {
      ...payload,
      timestamp: now,
      gameTime: state.gameTime,
    };
  }

  private isDefendingBase(state: ProcessedGameState): boolean {
    const enemyT3sAlive = (getEnemyBuildings(state).t3 ?? []).filter(
      (tower) => !tower.destroyed,
    );
    return enemyT3sAlive.length === 0;
  }

  private shouldBePushing(state: ProcessedGameState): boolean {
    const hasObjectives = getTowers(getEnemyBuildings(state)).some(
      (building) => !building.destroyed,
    );

    return hasObjectives && state.hero.alive;
  }
}
