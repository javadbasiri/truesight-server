// src/coaching/services/confidence-calculator.service.ts
import { Injectable } from '@nestjs/common';
import type {
  ConfidenceFactors,
  ConfidenceResult,
} from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import { getEnemyNetWorth } from '../utils/team-metrics.js';

/**
 * «تواضع معرفتی»: هر توصیه یک نمره‌ی اطمینان می‌گیرد تا موتور بتواند
 * توصیه‌های کم‌اطمینان را سرکوب یا لحن آن‌ها را نرم کند.
 */
@Injectable()
export class ConfidenceCalculatorService {
  public calculateConfidence(
    state: ProcessedGameState,
    adviceType: string,
    timingWindow?: number,
  ): ConfidenceResult {
    const factors: ConfidenceFactors = {
      dataCompleteness: this.calculateDataCompleteness(state),
      visionCertainty: this.calculateVisionCertainty(state),
      timingPrecision: this.calculateTimingPrecision(timingWindow),
      netWorthReliability: this.calculateNetWorthReliability(state),
    };

    const weights =
      adviceType.includes('push') || adviceType.includes('window')
        ? {
            dataCompleteness: 0.2,
            visionCertainty: 0.3,
            timingPrecision: 0.4,
            netWorthReliability: 0.1,
          }
        : {
            dataCompleteness: 0.3,
            visionCertainty: 0.3,
            timingPrecision: 0.2,
            netWorthReliability: 0.2,
          };

    const score =
      factors.dataCompleteness * weights.dataCompleteness +
      factors.visionCertainty * weights.visionCertainty +
      factors.timingPrecision * weights.timingPrecision +
      factors.netWorthReliability * weights.netWorthReliability;

    const reasons: string[] = [];
    if (factors.dataCompleteness < 0.7) {
      reasons.push('داده‌ی وضعیت بازی کامل نیست');
    }
    if (factors.visionCertainty < 0.6) {
      reasons.push('موقعیت دشمن مشخص نیست');
    }
    if (factors.timingPrecision < 0.7 && adviceType.includes('timing')) {
      reasons.push('پنجره‌ی زمانی دقیق نیست');
    }
    if (factors.netWorthReliability < 0.7) {
      reasons.push('داده‌ی ارزش خالص کامل نیست');
    }
    if (reasons.length === 0) {
      reasons.push('اطمینان بالا - همه‌ی داده‌ها قابل اتکا هستند');
    }

    return { score, factors, reasons };
  }

  /**
   * توصیه‌ی کم‌اطمینان و کم‌اهمیت را ارسال نکن (اما CRITICAL هرگز سرکوب نمی‌شود).
   */
  public shouldSuppressAdvice(confidence: number, priority: string): boolean {
    if (priority === 'GAME_ENDING' || priority === 'CRITICAL') {
      return false;
    }
    if (confidence < 0.5) {
      return true;
    }
    if (confidence < 0.7 && priority === 'LOW') {
      return true;
    }
    return false;
  }

  /**
   * نرم کردن لحن پیام بر اساس میزان اطمینان (نسخه‌ی فارسی).
   */
  public softenLanguage(message: string, confidence: number): string {
    if (confidence >= 0.8) {
      return message;
    }

    if (confidence >= 0.6) {
      return message
        .replace(/همین حالا/g, 'احتمالاً همین حالا')
        .replace(/حتماً/g, 'بهتر است')
        .replace(/باید/g, 'بهتر است');
    }

    return message
      .replace(/همین حالا/g, 'شاید بخواهی')
      .replace(/حتماً/g, 'شاید')
      .replace(/باید/g, 'می‌توانی')
      .replace(/بلاک کن/g, 'می‌توانی بلاک کنی');
  }

  private calculateDataCompleteness(state: ProcessedGameState): number {
    let completeness = 1;

    if (!state.player || !state.hero) {
      completeness -= 0.3;
    }
    if (!state.buildings?.radiant || !state.buildings?.dire) {
      completeness -= 0.2;
    }
    if (!state.items || state.items.allItems.length === 0) {
      completeness -= 0.1;
    }
    if (!state.abilities || Object.keys(state.abilities).length === 0) {
      completeness -= 0.1;
    }

    // اگر سکشن allplayers فعال نباشد، نبود فهرست تیمی نقص داده نیست؛
    // جریمه نمی‌کنیم تا توصیه‌های معتبر روی هیروی خودمان تولید شوند.
    const rosterComplete =
      state.team.players.length > 1
        ? Math.min(state.team.players.length, 5) / 5
        : 1;
    completeness = (completeness + rosterComplete) / 2;

    return Math.max(0, Math.min(1, completeness));
  }

  private calculateVisionCertainty(state: ProcessedGameState): number {
    // بدون داده‌ی allplayers، اطلاعاتی از موقعیت دشمن نداریم؛
    // ۰.۶ یک پیشینِ خنثی است، نه ادعای قطعیت.
    if (state.enemies.length === 0) {
      return 0.6;
    }

    const visibleEnemies = state.enemies.filter(
      (enemy) => enemy.visible,
    ).length;
    const totalEnemies = state.enemies.length || 5;

    let certainty = visibleEnemies / totalEnemies;

    const enemiesWithPosition = state.enemies.filter(
      (enemy) => enemy.position,
    ).length;
    if (enemiesWithPosition > 0) {
      certainty = Math.min(1, certainty + 0.2);
    }

    const missingEnemies = totalEnemies - visibleEnemies;
    if (missingEnemies >= 3) {
      certainty *= 0.7;
    }

    return Math.max(0, Math.min(1, certainty));
  }

  private calculateTimingPrecision(timingWindow?: number): number {
    if (!timingWindow) {
      return 0.5;
    }
    if (timingWindow < 30) {
      return 0.9;
    }
    if (timingWindow < 60) {
      return 0.8;
    }
    if (timingWindow < 120) {
      return 0.6;
    }
    return 0.4;
  }

  private calculateNetWorthReliability(state: ProcessedGameState): number {
    if (state.enemies.length < 4) {
      // بدون فهرست دشمن، ارزش خالص قابل مقایسه نیست؛ پیشینِ خنثی برمی‌گردانیم
      // تا توصیه‌های غیرمالی سرکوب نشوند.
      return 0.5;
    }

    const teamNetWorth = state.team.netWorth;
    const enemyNetWorth = getEnemyNetWorth(state);

    if (teamNetWorth > 0 && enemyNetWorth > 0) {
      const enemiesWithNetWorth = state.enemies.filter(
        (enemy) => enemy.netWorth > 0,
      ).length;
      const enemyDataCompleteness =
        enemiesWithNetWorth / Math.max(state.enemies.length, 1);
      return 0.5 + enemyDataCompleteness * 0.5;
    }

    if (teamNetWorth > 0) {
      return 0.6;
    }

    return 0.3;
  }
}
