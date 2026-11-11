// src/coaching/services/post-game-analyzer.service.ts
import { Injectable } from '@nestjs/common';
import type {
  CoachingAdvice,
  GameEvent,
  NetWorthContext,
  PostGameSummary,
} from '../interfaces/coaching.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';

/**
 * تحلیل بعد از بازی: پنجره‌های پوش، فرصت‌های عقب‌کشیدن و لحظات تعیین‌کننده
 * ثبت می‌شوند تا بازیکن ببیند کجاها بازی را از دست داده است.
 */
@Injectable()
export class PostGameAnalyzerService {
  private events: GameEvent[] = [];
  private adviceHistory: CoachingAdvice[] = [];
  private gameStartTime = 0;
  private isGameActive = false;

  public recordEvent(event: GameEvent): void {
    this.events.push(event);
  }

  public recordAdvice(advice: CoachingAdvice): void {
    this.adviceHistory.push(advice);
  }

  public trackPushWindow(
    state: ProcessedGameState,
    windowType: string,
    advice: CoachingAdvice | null,
    netWorthContext?: NetWorthContext,
  ): void {
    const confidence = advice?.confidence ?? 0.5;

    this.recordEvent({
      type: 'push_window',
      timestamp: Date.now(),
      gameTime: state.gameTime,
      description: `پنجره‌ی پوش: ${windowType}`,
      severity: advice?.priority === 'GAME_ENDING' ? 'high' : 'medium',
      adviceGiven: advice?.message,
      outcome: advice ? 'taken' : 'missed',
      confidence,
      netWorthContext,
      weight: this.calculateEventWeight(confidence, netWorthContext),
    });
  }

  public trackBackOpportunity(
    state: ProcessedGameState,
    reason: string,
    advice: CoachingAdvice | null,
    netWorthContext?: NetWorthContext,
  ): void {
    const confidence = advice?.confidence ?? 0.5;

    this.recordEvent({
      type: 'back_opportunity',
      timestamp: Date.now(),
      gameTime: state.gameTime,
      description: `فرصت عقب‌کشیدن: ${reason}`,
      severity: 'medium',
      adviceGiven: advice?.message,
      outcome: advice ? 'taken' : 'missed',
      confidence,
      netWorthContext,
      weight: this.calculateEventWeight(confidence, netWorthContext),
    });
  }

  public trackDecisiveMoment(
    state: ProcessedGameState,
    description: string,
    impact: 'high' | 'medium' | 'low',
  ): void {
    this.recordEvent({
      type: 'decisive_moment',
      timestamp: Date.now(),
      gameTime: state.gameTime,
      description,
      severity: impact,
      outcome: 'unknown',
    });
  }

  public recordThrowWarning(
    state: ProcessedGameState,
    description: string,
  ): void {
    this.recordEvent({
      type: 'throw_warning',
      timestamp: Date.now(),
      gameTime: state.gameTime,
      description,
      severity: 'high',
      outcome: 'taken',
    });
  }

  public startGame(): void {
    this.events = [];
    this.adviceHistory = [];
    this.gameStartTime = Date.now();
    this.isGameActive = true;
  }

  public endGame(gameTime: number): PostGameSummary {
    this.isGameActive = false;
    return this.generateSummary(gameTime);
  }

  public generateSummary(gameTime: number): PostGameSummary {
    const missedPushWindows = this.events.filter(
      (event) => event.type === 'push_window' && event.outcome === 'missed',
    );
    const missedBackOpportunities = this.events.filter(
      (event) =>
        event.type === 'back_opportunity' && event.outcome === 'missed',
    );
    const decisiveMoments = this.events.filter(
      (event) => event.type === 'decisive_moment',
    );

    const withConfidence = this.events.filter(
      (event) => event.confidence !== undefined,
    );
    const averageConfidence =
      withConfidence.length > 0
        ? withConfidence.reduce(
            (sum, event) => sum + (event.confidence ?? 0),
            0,
          ) / withConfidence.length
        : 0;

    return {
      gameDuration: gameTime,
      events: [...this.events],
      missedPushWindows,
      missedBackOpportunities,
      decisiveMoments,
      recommendations: this.generateRecommendations(
        missedPushWindows,
        missedBackOpportunities,
        decisiveMoments,
      ),
      confidenceWeightedAnalysis: {
        highConfidenceMissed: missedPushWindows.filter(
          (event) => (event.confidence ?? 0) >= 0.7,
        ).length,
        lowConfidenceMissed: missedPushWindows.filter(
          (event) => (event.confidence ?? 0) < 0.5,
        ).length,
        highConfidenceTaken: this.events.filter(
          (event) =>
            event.type === 'push_window' &&
            event.outcome === 'taken' &&
            (event.confidence ?? 0) >= 0.7,
        ).length,
        averageConfidence,
      },
    };
  }

  public formatSummary(summary: PostGameSummary): string {
    const lines: string[] = [];
    lines.push('=== تحلیل بعد از بازی ===');
    lines.push(`مدت بازی: ${this.formatClock(summary.gameDuration)}`);
    lines.push('');

    if (summary.missedPushWindows.length > 0) {
      lines.push('پنجره‌های پوش از دست‌رفته:');
      [...summary.missedPushWindows]
        .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
        .forEach((event) => {
          const confidence = event.confidence
            ? ` [اطمینان: ${Math.round(event.confidence * 100)}%]`
            : '';
          lines.push(
            `  - ${this.formatClock(event.gameTime)} - ${event.description}${confidence}`,
          );
          if (event.adviceGiven) {
            lines.push(`    توصیه: ${event.adviceGiven}`);
          }
        });
      lines.push('');
    }

    if (summary.missedBackOpportunities.length > 0) {
      lines.push('فرصت‌های عقب‌کشیدن از دست‌رفته:');
      summary.missedBackOpportunities.forEach((event) => {
        lines.push(
          `  - ${this.formatClock(event.gameTime)} - ${event.description}`,
        );
      });
      lines.push('');
    }

    if (summary.decisiveMoments.length > 0) {
      lines.push('لحظات تعیین‌کننده:');
      summary.decisiveMoments.forEach((event) => {
        lines.push(
          `  - ${this.formatClock(event.gameTime)} - ${event.description} (${event.severity})`,
        );
      });
      lines.push('');
    }

    lines.push('پیشنهادها:');
    summary.recommendations.forEach((recommendation) =>
      lines.push(`  - ${recommendation}`),
    );
    lines.push('');
    lines.push('تحلیل وزن‌دار بر اساس اطمینان:');
    lines.push(
      `  فرصت‌های مهم از دست‌رفته: ${summary.confidenceWeightedAnalysis.highConfidenceMissed}`,
    );
    lines.push(
      `  فرصت‌های کم‌اطمینان از دست‌رفته: ${summary.confidenceWeightedAnalysis.lowConfidenceMissed}`,
    );
    lines.push(
      `  فرصت‌های مهم استفاده‌شده: ${summary.confidenceWeightedAnalysis.highConfidenceTaken}`,
    );
    lines.push(
      `  میانگین اطمینان: ${(summary.confidenceWeightedAnalysis.averageConfidence * 100).toFixed(1)}%`,
    );

    return lines.join('\n');
  }

  public isActive(): boolean {
    return this.isGameActive;
  }

  public getEvents(): GameEvent[] {
    return [...this.events];
  }

  public getAdviceHistory(): CoachingAdvice[] {
    return [...this.adviceHistory];
  }

  public clear(): void {
    this.events = [];
    this.adviceHistory = [];
    this.gameStartTime = 0;
    this.isGameActive = false;
  }

  private generateRecommendations(
    missedPushWindows: GameEvent[],
    missedBackOpportunities: GameEvent[],
    decisiveMoments: GameEvent[],
  ): string[] {
    const recommendations: string[] = [];

    if (missedPushWindows.length > 0) {
      recommendations.push(
        `${missedPushWindows.length} پنجره‌ی پوش از دست رفت - این موارد را دقیق مرور کن`,
      );
    }
    if (missedBackOpportunities.length > 0) {
      recommendations.push(
        `${missedBackOpportunities.length} فرصت عقب‌کشیدن از دست رفت - ارزیابی ریسک را بهتر کن`,
      );
    }
    if (decisiveMoments.length > 0) {
      recommendations.push(
        `${decisiveMoments.length} لحظه‌ی تعیین‌کننده ثبت شد - این پلی‌ها را مرور کن`,
      );
    }

    const criticalAdvice = this.adviceHistory.filter(
      (advice) =>
        advice.priority === 'CRITICAL' || advice.priority === 'GAME_ENDING',
    );
    if (criticalAdvice.length > 5) {
      recommendations.push(
        'موقعیت‌های بحرانی زیاد بود - روی جلوگیری از اشتباهات زودتر تمرکز کن',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('تصمیم‌گیری کلی خوب بود - همین روند را ادامه بده');
    }

    return recommendations;
  }

  private calculateEventWeight(
    confidence: number,
    netWorthContext?: NetWorthContext,
  ): number {
    let weight = confidence;

    if (netWorthContext) {
      const swingBonus = Math.min(Math.abs(netWorthContext.delta) / 20000, 0.5);
      weight += swingBonus;
    }

    return Math.max(0, Math.min(1, weight));
  }

  private formatClock(gameTime: number): string {
    const safe = Math.max(0, Math.floor(gameTime));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
}
