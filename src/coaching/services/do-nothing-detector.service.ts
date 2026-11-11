// src/coaching/services/do-nothing-detector.service.ts
import { Injectable } from '@nestjs/common';
import type {
  CoachingAdvice,
  DoNothingState,
} from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import {
  countDeadEnemies,
  getEnemyBuildings,
  getNetWorthDelta,
} from '../utils/team-metrics.js';

/**
 * «سکوت عمدی» یک تصمیم است، نه نبود تصمیم.
 * وقتی هیچ اقدامی بهترین اقدام است، این سرویس آن را به‌صورت صریح تشخیص می‌دهد
 * تا موتور کوچینگ از تولید پیام‌های بی‌ارزش جلوگیری کند.
 */
@Injectable()
export class DoNothingDetectorService {
  public detect(state: ProcessedGameState): DoNothingState | null {
    if (this.isFarmingPhase(state)) {
      return {
        detected: true,
        reason: 'فاز فارم است - کنترل مپ را حفظ کن، اقدام فوری لازم نیست',
        confidence: 0.8,
        duration: 60,
      };
    }

    if (this.isWaitingForCooldowns(state)) {
      return {
        detected: true,
        reason: 'اسپل‌های کلیدی روی کول‌داون هستند - قبل از درگیر شدن صبر کن',
        confidence: 0.7,
        duration: 30,
      };
    }

    if (this.isMaintainingAdvantage(state)) {
      return {
        detected: true,
        reason: 'برتری حفظ شده - اقدام خاصی توصیه نمی‌شود',
        confidence: 0.75,
        duration: 90,
      };
    }

    if (this.isDefensivePositioning(state)) {
      return {
        detected: true,
        reason: 'موقعیت دفاعی - وضعیت فعلی را حفظ کن',
        confidence: 0.7,
        duration: 60,
      };
    }

    return null;
  }

  public createDoNothingAdvice(
    doNothingState: DoNothingState,
    state: ProcessedGameState,
  ): CoachingAdvice {
    return {
      priority: 'LOW',
      message: doNothingState.reason,
      action: 'maintain',
      timestamp: Date.now(),
      gameTime: state.gameTime,
      confidence: doNothingState.confidence,
      isDoNothing: true,
      netWorthContext: {
        delta: getNetWorthDelta(state),
        deltaPercent: 0,
      },
    };
  }

  private isFarmingPhase(state: ProcessedGameState): boolean {
    if (state.gameTime >= 600) {
      return false;
    }

    const enemyBuildings = getEnemyBuildings(state);
    const t1Alive = (enemyBuildings.t1 ?? []).filter(
      (tower) => !tower.destroyed,
    ).length;

    return t1Alive >= 2 && state.player.lastHits > 0;
  }

  private isWaitingForCooldowns(state: ProcessedGameState): boolean {
    const ultimates = Object.values(state.abilities).filter(
      (ability) => ability.isUltimate,
    );
    if (ultimates.length === 0) {
      return false;
    }

    const onShortCooldown = ultimates.filter(
      (ability) =>
        ability.cooldownRemaining > 0 && ability.cooldownRemaining < 60,
    );

    return onShortCooldown.length >= ultimates.length * 0.5;
  }

  private isMaintainingAdvantage(state: ProcessedGameState): boolean {
    return getNetWorthDelta(state) > 3000 && countDeadEnemies(state) === 0;
  }

  private isDefensivePositioning(state: ProcessedGameState): boolean {
    return getNetWorthDelta(state) < -2000 && state.hero.healthPercent < 50;
  }
}
