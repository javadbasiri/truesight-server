// src/coaching/services/net-worth-tracker.service.ts
import { Injectable } from '@nestjs/common';
import type { NetWorthAnalysis } from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import { getEnemyNetWorth, hasNetWorthData } from '../utils/team-metrics.js';

interface NetWorthSample {
  time: number;
  teamNW: number;
  enemyNW: number;
  delta: number;
}

/**
 * تفاضل ارزش خالص (Net Worth Delta) یکی از قوی‌ترین سیگنال‌های تصمیم‌گیری
 * ماکرو است. این سرویس روند آن را دنبال و پیشنهاد استراتژیک تولید می‌کند.
 */
@Injectable()
export class NetWorthTrackerService {
  private history: NetWorthSample[] = [];
  private readonly historySize = 20;

  public analyze(state: ProcessedGameState): NetWorthAnalysis {
    if (!hasNetWorthData(state)) {
      return {
        teamNetWorth: state.team.netWorth,
        enemyNetWorth: 0,
        delta: 0,
        deltaPercent: 0,
        trend: 'stable',
        recommendation: '',
        signals: ['داده‌ی کافی برای مقایسه‌ی ارزش خالص موجود نیست'],
      };
    }

    const teamNetWorth = state.team.netWorth;
    const enemyNetWorth = getEnemyNetWorth(state);
    const delta = teamNetWorth - enemyNetWorth;
    const deltaPercent = enemyNetWorth > 0 ? (delta / enemyNetWorth) * 100 : 0;

    this.history.push({
      time: state.gameTime,
      teamNW: teamNetWorth,
      enemyNW: enemyNetWorth,
      delta,
    });
    if (this.history.length > this.historySize) {
      this.history.shift();
    }

    const trend = this.calculateTrend();
    const signals: string[] = [];
    let recommendation = '';

    if (delta > 6000) {
      signals.push('برتری بزرگ ارزش خالص', 'آبجکتیو را فورس کن');
      recommendation = 'اختلاف بزرگ - آبجکتیو را فورس کن و فایت ریسکی نده';

      const deadCoresNoBuyback = state.enemies.filter(
        (enemy) =>
          !enemy.alive &&
          !enemy.buybackAvailable &&
          enemy.netWorth > teamNetWorth * 0.15,
      );
      if (deadCoresNoBuyback.length > 0) {
        signals.push('کری دشمن مرده و بای‌بک ندارد');
        recommendation =
          'همین حالا بازی را تمام کن - کری دشمن مرده و بای‌بک ندارد';
      }
    } else if (delta > 3000) {
      signals.push('برتری متوسط ارزش خالص', 'از برتری پوش بده');
      recommendation = 'برتری متوسط - آبجکتیو بزن و ترید امن کن';
    } else if (delta > -1500 && delta < 1500) {
      signals.push('ارزش خالص برابر', 'از فایت ۵ به ۵ دوری کن');
      recommendation = 'بازی برابر - از فایت ۵ به ۵ دوری کن و دنبال پیک‌آف باش';
    } else if (delta < -3000) {
      signals.push('کمبود ارزش خالص', 'دفاعی بازی کن');
      recommendation =
        'عقب هستی - دفاعی بازی کن، امن فارم کن و منتظر اشتباه حریف بمان';
    } else {
      signals.push('کمی عقب‌تر', 'با احتیاط ترید کن');
      recommendation = 'کمی عقب‌تری - با احتیاط ترید کن و فایت بد نده';
    }

    if (trend === 'increasing' && delta > 0) {
      signals.push('برتری در حال رشد');
      recommendation += ' - برتری در حال رشد است، فشار را حفظ کن';
    } else if (trend === 'decreasing' && delta > 0) {
      signals.push('برتری در حال کاهش');
      recommendation += ' - برتری کم می‌شود، هر چه زودتر آبجکتیو بگیر';
    } else if (trend === 'decreasing' && delta < 0) {
      signals.push('فاصله در حال بیشتر شدن');
      recommendation += ' - عقب‌تر می‌روی، اول وضعیت را تثبیت کن';
    }

    if (this.detectNetWorthSpike()) {
      signals.push('پاور اسپایک ارزش خالص');
      recommendation += ' - پاور اسپایک، پوش را هماهنگ کن';
    }

    return {
      teamNetWorth,
      enemyNetWorth,
      delta,
      deltaPercent,
      trend,
      recommendation,
      signals,
    };
  }

  public getPushRecommendation(
    analysis: NetWorthAnalysis,
    state: ProcessedGameState,
  ): string | null {
    if (!hasNetWorthData(state)) {
      return null;
    }

    if (analysis.delta > 6000) {
      const deadNoBuyback = state.enemies.filter(
        (enemy) => !enemy.alive && !enemy.buybackAvailable,
      );
      if (deadNoBuyback.length >= 2) {
        return 'برتری بزرگ + دشمن مرده بدون بای‌بک ← همین حالا آبجکتیو را فورس کن';
      }
    }

    if (analysis.delta > 0 && analysis.delta < 5000) {
      return 'برتری کوچک ← ترید امن کن و از فایت ۵ به ۵ دوری کن';
    }

    if (this.detectNetWorthSpike() && analysis.delta > 0) {
      return 'پاور اسپایک ارزش خالص ← پوش را همین حالا هماهنگ کن';
    }

    return null;
  }

  public clear(): void {
    this.history = [];
  }

  private calculateTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.history.length < 3) {
      return 'stable';
    }

    const recent = this.history.slice(-3);
    const [first, second, third] = recent;

    if (third.delta > second.delta && second.delta > first.delta) {
      return 'increasing';
    }
    if (third.delta < second.delta && second.delta < first.delta) {
      return 'decreasing';
    }

    return 'stable';
  }

  private detectNetWorthSpike(): boolean {
    if (this.history.length < 2) {
      return false;
    }

    const last = this.history[this.history.length - 1];
    const previous = this.history[this.history.length - 2];
    const timeDelta = last.time - previous.time;
    const netWorthDelta = last.teamNW - previous.teamNW;

    return timeDelta < 60 && netWorthDelta > 1500;
  }
}
