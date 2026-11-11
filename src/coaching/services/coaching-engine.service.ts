// src/coaching/services/coaching-engine.service.ts
import { Injectable, Optional } from '@nestjs/common';
import type { GsiPayload } from '../../gsi/interfaces/gsi-payload.interface.js';
import type { CoachAlertPayload } from '../../gsi/interfaces/gsi-payload.interface.js';
import type { ProcessedGameState } from '../../gsi/interfaces/processed-game-state.interface.js';
import type {
  CoachingAdvice,
  CoachingStatus,
  GamePhase,
  PostGameSummary,
  WinConditionAnalysis,
} from '../interfaces/coaching.interface.js';
import {
  COACHING_EVALUATION_THROTTLE_MS,
  GAME_PHASES,
} from '../config/coaching.constants.js';
import {
  getEnemyBuildings,
  getExpectedCS,
  getLowHealthTowers,
} from '../utils/team-metrics.js';
import { CoachGateway } from '../../coach.gateway.js';
import { GameStateProcessorService } from './game-state-processor.service.js';
import { WinConditionAnalyzerService } from './win-condition-analyzer.service.js';
import { NetWorthTrackerService } from './net-worth-tracker.service.js';
import { CombatAnalyzerService } from './combat-analyzer.service.js';
import { LaningCoachService } from './laning-coach.service.js';
import { MidgameCoachService } from './midgame-coach.service.js';
import { LategameCoachService } from './lategame-coach.service.js';
import { SituationDatabaseService } from './situation-database.service.js';
import { AntiThrowService } from './anti-throw.service.js';
import { PushTimingDetectorService } from './push-timing-detector.service.js';
import { PhaseCoachingService } from './phase-coaching.service.js';
import { ItemBuildAdvisorService } from './item-build-advisor.service.js';
import { HeroSpecificAdviceService } from './hero-specific-advice.service.js';
import { DoNothingDetectorService } from './do-nothing-detector.service.js';
import { ConfidenceCalculatorService } from './confidence-calculator.service.js';
import { MessageQueueService } from './message-queue.service.js';
import { MessageFormatterService } from './message-formatter.service.js';
import { PlayerTrustCalibratorService } from './player-trust-calibrator.service.js';
import { PostGameAnalyzerService } from './post-game-analyzer.service.js';
import { SteamChatBotService } from './steam-chat-bot.service.js';

const IN_PROGRESS = 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS';
const POST_GAME = 'DOTA_GAMERULES_STATE_POST_GAME';

/**
 * مغز کوچینگ: تمام سرویس‌های تخصصی را هماهنگ می‌کند و خروجی نهایی را
 * با کنترل نرخ، اطمینان و کالیبراسیون اعتماد به کلاینت می‌فرستد.
 */
@Injectable()
export class CoachingEngineService {
  private currentMatchId = '';
  private lastEvaluatedClockTime = -9999;
  private lastEvaluationAt = 0;
  private lastAdvice: CoachingAdvice | null = null;
  private lastAlertAt: number | null = null;
  private previousState: ProcessedGameState | null = null;
  private pendingAdviceId: string | null = null;
  private winConditionAnalysis: WinConditionAnalysis | null = null;
  private gamePhase: GamePhase = 'laning';
  private lastNetWorthAnalysis: ReturnType<
    NetWorthTrackerService['analyze']
  > | null = null;
  private gameWasActive = false;
  private lastStatusAt = 0;
  private postGameSummary: PostGameSummary | null = null;

  constructor(
    private readonly processor: GameStateProcessorService,
    private readonly winConditionAnalyzer: WinConditionAnalyzerService,
    private readonly netWorthTracker: NetWorthTrackerService,
    private readonly combatAnalyzer: CombatAnalyzerService,
    private readonly laningCoach: LaningCoachService,
    private readonly midgameCoach: MidgameCoachService,
    private readonly lategameCoach: LategameCoachService,
    private readonly situationDatabase: SituationDatabaseService,
    private readonly antiThrow: AntiThrowService,
    private readonly pushTimingDetector: PushTimingDetectorService,
    private readonly phaseCoaching: PhaseCoachingService,
    private readonly itemBuildAdvisor: ItemBuildAdvisorService,
    private readonly heroSpecificAdvice: HeroSpecificAdviceService,
    private readonly doNothingDetector: DoNothingDetectorService,
    private readonly confidenceCalculator: ConfidenceCalculatorService,
    private readonly messageQueue: MessageQueueService,
    private readonly messageFormatter: MessageFormatterService,
    private readonly trustCalibrator: PlayerTrustCalibratorService,
    private readonly postGameAnalyzer: PostGameAnalyzerService,
    private readonly coachGateway: CoachGateway,
    @Optional() private readonly steamBot?: SteamChatBotService,
  ) {}

  /**
   * نقطه‌ی ورود اصلی: هر تیک GSI را پردازش می‌کند.
   * ارزیابی حداکثر یک بار در هر ثانیه‌ی بازی انجام می‌شود (ضد اسپم).
   */
  public processTick(payload: GsiPayload): CoachingAdvice | null {
    const state = this.processor.process(payload);
    if (!state) {
      return null;
    }

    if (state.gameState === POST_GAME) {
      this.handleGameEnd(state);
      return null;
    }

    if (state.gameState !== IN_PROGRESS) {
      return null;
    }

    this.ensureMatchState(state);

    const previous = this.previousState;
    this.previousState = state;
    this.emitStatus();

    const now = Date.now();
    if (
      state.clockTime === this.lastEvaluatedClockTime ||
      now - this.lastEvaluationAt < COACHING_EVALUATION_THROTTLE_MS
    ) {
      return this.flushPendingAdvice(state);
    }

    this.lastEvaluatedClockTime = state.clockTime;
    this.lastEvaluationAt = now;

    if (this.pendingAdviceId && previous) {
      this.trustCalibrator.checkCompliance(
        this.pendingAdviceId,
        state,
        previous,
      );
      this.pendingAdviceId = null;
    }

    const advice = this.generateAdvice(state);
    if (!advice) {
      return null;
    }

    if (!this.messageQueue.shouldSend(advice)) {
      return null;
    }

    this.publish(advice, state);
    return this.lastAdvice;
  }

  /**
   * تیک‌های بعدی را با صف بررسی می‌کند تا پیام‌های HIGH از دست نروند.
   * توسط GSI در هر فراخوانی processTick قابل استفاده است.
   */
  public flushPendingAdvice(state?: ProcessedGameState): CoachingAdvice | null {
    const pending = this.messageQueue.getNextPending();
    if (!pending) {
      return null;
    }

    if (state) {
      this.publish(pending, state);
    } else {
      this.messageQueue.markSent(pending);
      this.lastAdvice = pending;
    }

    return pending;
  }

  public reset(): void {
    this.currentMatchId = '';
    this.lastEvaluatedClockTime = -9999;
    this.lastEvaluationAt = 0;
    this.previousState = null;
    this.pendingAdviceId = null;
    this.winConditionAnalysis = null;
    this.lastNetWorthAnalysis = null;
    this.lastAdvice = null;
    this.lastAlertAt = null;
    this.gameWasActive = false;

    this.netWorthTracker.clear();
    this.messageQueue.clear();
    this.situationDatabase.clearCooldowns();
    this.pushTimingDetector.clear();
    this.antiThrow.clear();
    this.laningCoach.clear();
    this.midgameCoach.clear();
    this.lategameCoach.clear();
    this.combatAnalyzer.clear();
    this.trustCalibrator.clear();
    this.postGameAnalyzer.clear();
  }

  public getStatus(): CoachingStatus {
    return {
      inGame: this.previousState?.gameState === IN_PROGRESS,
      matchId: this.currentMatchId,
      clockTime: this.previousState?.clockTime ?? 0,
      gamePhase: this.previousState
        ? this.determineGamePhase(this.previousState.gameTime)
        : this.gamePhase,
      winCondition: this.winConditionAnalysis,
      netWorth: this.lastNetWorthAnalysis,
      trustMetrics: this.trustCalibrator.getTrustMetrics(),
      lastAdvice: this.lastAdvice,
      lastAlertAt: this.lastAlertAt,
    };
  }

  public getPostGameSummary(): PostGameSummary | null {
    return this.postGameSummary;
  }

  public getPostGameText(): string | null {
    return this.postGameSummary
      ? this.postGameAnalyzer.formatSummary(this.postGameSummary)
      : null;
  }

  private ensureMatchState(state: ProcessedGameState): void {
    const isNewMatch = state.matchId !== this.currentMatchId;
    const isClockRewound = state.clockTime < this.lastEvaluatedClockTime - 5;

    if (!isNewMatch && !isClockRewound) {
      return;
    }

    this.currentMatchId = state.matchId;
    this.lastEvaluatedClockTime = -9999;
    this.lastEvaluationAt = 0;
    this.previousState = null;
    this.pendingAdviceId = null;
    this.winConditionAnalysis = null;
    this.lastNetWorthAnalysis = null;
    this.lastAdvice = null;
    this.postGameSummary = null;

    this.netWorthTracker.clear();
    this.messageQueue.clear();
    this.situationDatabase.clearCooldowns();
    this.pushTimingDetector.clear();
    this.antiThrow.clear();
    this.laningCoach.clear();
    this.midgameCoach.clear();
    this.lategameCoach.clear();
    this.combatAnalyzer.clear();
    this.trustCalibrator.clear();
    this.postGameAnalyzer.startGame();

    this.gameWasActive = true;
  }

  private generateAdvice(state: ProcessedGameState): CoachingAdvice | null {
    this.gamePhase = this.determineGamePhase(state.gameTime);
    this.lastNetWorthAnalysis = this.netWorthTracker.analyze(state);

    if (!this.winConditionAnalysis || state.gameTime % 15 === 0) {
      this.winConditionAnalysis = this.winConditionAnalyzer.analyze(state);
    }

    const candidates: Array<{
      advice: CoachingAdvice | null;
      type: string;
      timingWindow?: number;
    }> = [];

    candidates.push({
      advice: this.combatAnalyzer.analyzeCombat(state),
      type: 'combat',
    });

    if (state.gameTime < 600) {
      candidates.push({
        advice: this.laningCoach.getAdvice(state),
        type: 'laning',
      });
    } else if (state.gameTime < 1800) {
      candidates.push({
        advice: this.midgameCoach.getAdvice(state),
        type: 'midgame',
      });
    } else {
      candidates.push({
        advice: this.lategameCoach.getAdvice(state),
        type: 'lategame',
      });
    }

    candidates.push({
      advice: this.situationDatabase.checkSituations(state),
      type: 'situational',
    });
    candidates.push({
      advice: this.antiThrow.checkThrowScenarios(state),
      type: 'anti_throw',
    });

    const pushWindow = this.pushTimingDetector.detectPushWindows(state)[0];
    if (pushWindow) {
      const advice: CoachingAdvice = {
        priority: pushWindow.priority,
        message: pushWindow.message,
        action: this.getActionFromWindowType(pushWindow.type),
        timestamp: Date.now(),
        gameTime: state.gameTime,
      };
      const enriched = this.enrichAdvice(
        advice,
        state,
        'push_window',
        pushWindow.duration,
      );
      this.postGameAnalyzer.trackPushWindow(
        state,
        pushWindow.type,
        enriched,
        enriched?.netWorthContext,
      );
      candidates.push({
        advice: enriched,
        type: 'push_window',
        timingWindow: pushWindow.duration,
      });
    }

    if (this.lastNetWorthAnalysis) {
      const recommendation = this.netWorthTracker.getPushRecommendation(
        this.lastNetWorthAnalysis,
        state,
      );

      if (recommendation) {
        candidates.push({
          advice: {
            priority: 'HIGH',
            message: recommendation,
            action: 'push',
            timestamp: Date.now(),
            gameTime: state.gameTime,
          },
          type: 'net_worth',
        });
      }
    }

    candidates.push({
      advice: this.phaseCoaching.getAdvice(
        state,
        this.gamePhase,
        this.winConditionAnalysis,
      ),
      type: 'phase_coaching',
    });
    candidates.push({
      advice: this.itemBuildAdvisor.getRecommendations(state),
      type: 'item_build',
    });
    candidates.push({
      advice: this.heroSpecificAdvice.getAdvice(state),
      type: 'hero_specific',
    });
    candidates.push({
      advice: this.heroSpecificAdvice.getAbilityTips(state),
      type: 'ability_usage',
    });

    for (const candidate of candidates) {
      if (!candidate.advice) {
        continue;
      }

      const enriched = this.enrichAdvice(
        candidate.advice,
        state,
        candidate.type,
        candidate.timingWindow,
      );

      if (enriched) {
        return enriched;
      }
    }

    // سکوت عمدی: وقتی هیچ اقدامی بهترین اقدام است، پیام تولید نمی‌کنیم.
    if (this.doNothingDetector.detect(state)) {
      return null;
    }

    const strategic = this.enrichAdvice(
      this.generateStrategicAdvice(state) ??
        this.generatePeriodicAdvice(state)!,
      state,
      'strategic',
    );

    return strategic;
  }

  private enrichAdvice(
    advice: CoachingAdvice,
    state: ProcessedGameState,
    adviceType: string,
    timingWindow?: number,
  ): CoachingAdvice | null {
    const confidence = this.confidenceCalculator.calculateConfidence(
      state,
      `${adviceType} ${advice.action ?? ''}`,
      timingWindow,
    );

    if (
      this.confidenceCalculator.shouldSuppressAdvice(
        confidence.score,
        advice.priority,
      )
    ) {
      return null;
    }

    let message = this.confidenceCalculator.softenLanguage(
      advice.message,
      confidence.score,
    );
    if (this.trustCalibrator.shouldIncreaseExplanation()) {
      message = `${message} (${confidence.reasons.join('، ')})`;
    }

    const netWorthContext =
      advice.netWorthContext ??
      (this.lastNetWorthAnalysis && this.processor.hasEnemyRoster(state)
        ? {
            delta: this.lastNetWorthAnalysis.delta,
            deltaPercent: this.lastNetWorthAnalysis.deltaPercent,
          }
        : undefined);

    return {
      ...advice,
      message,
      confidence: confidence.score,
      confidenceReasons: confidence.reasons,
      netWorthContext,
    };
  }

  private handleGameEnd(state: ProcessedGameState): void {
    if (!this.gameWasActive) {
      return;
    }

    this.gameWasActive = false;
    this.postGameSummary = this.postGameAnalyzer.endGame(state.gameTime);

    this.coachGateway.sendPostGameSummary({
      text: this.postGameAnalyzer.formatSummary(this.postGameSummary),
      summary: this.postGameSummary,
    });
  }

  private generateStrategicAdvice(
    state: ProcessedGameState,
  ): CoachingAdvice | null {
    const expectedCS = getExpectedCS(state.gameTime);

    if (state.player.lastHits < expectedCS * 0.85) {
      return {
        priority: 'MEDIUM',
        message: `CS: ${state.player.lastHits}/${expectedCS} - روی فارم تمرکز کن، برای تایمینگ پوش گلد لازم داری`,
        action: 'farm',
        timestamp: Date.now(),
        gameTime: state.gameTime,
      };
    }

    const lowTowers = getLowHealthTowers(getEnemyBuildings(state), 70).filter(
      (tower) => tower.name.includes('t1') || tower.name.includes('t2'),
    );

    if (lowTowers.length > 0 && state.hero.healthPercent > 50) {
      return {
        priority: 'MEDIUM',
        message: `تاور دشمن روی ${Math.floor(lowTowers[0].healthPercent)}% است - با موج بعدی تمامش کن`,
        action: 'push',
        timestamp: Date.now(),
        gameTime: state.gameTime,
      };
    }

    if (
      state.gameTime > 1200 &&
      !state.roshan.alive &&
      state.roshan.respawnTime &&
      state.roshan.respawnTime - state.gameTime < 60
    ) {
      return {
        priority: 'HIGH',
        message: 'روشان به زودی اسپاون می‌شود - برای هایگراند آیجیس را بگیر',
        action: 'roshan',
        timestamp: Date.now(),
        gameTime: state.gameTime,
      };
    }

    return null;
  }

  private generatePeriodicAdvice(state: ProcessedGameState): CoachingAdvice {
    const phase = this.determineGamePhase(state.gameTime);
    const minute = Math.floor(state.gameTime / 60);
    const csTarget = getExpectedCS(state.gameTime);

    const messages: Record<GamePhase, string[]> = {
      laning: [
        `روی لست‌هیت تمرکز کن - هدف ${csTarget} CS تا دقیقه ${minute}`,
        'رون‌های ۲ و ۴ دقیقه را برای XP و گلد بگیر',
        'مینی‌مپ را ببین - دشمن غایب یعنی احتمال گنک',
        'کمپ‌ها را برای فارم بعدی استک کن',
        'کارآمد ترید کن - وقتی دشمن جای بدی ایستاده اسپل بزن',
      ],
      midgame: [
        'برای آبجکتیو با تیم گروه شو - تنها فارم نکن',
        'دور پیت روشان وارد و دید بگذار',
        'قبل از فایت لین‌ها را پوش بده',
        'بای‌بک را برای فایت‌های مهم نگه دار',
        'روی گرفتن T2 تمرکز کن تا مپ باز شود',
      ],
      lategame: [
        'کنار هم بایستید - یک پیک‌آف بازی را می‌بازد',
        'قبل از هایگراند آیجیس را بگیر',
        'ترو نکن - منتظر اشتباه دشمن بمان',
        'قبل از پوش، دید هایگراند را کنترل کن',
        'بای‌بک را نگه دار - در فایت‌های آخر حیاتی است',
      ],
    };

    const list = messages[phase];
    const index = Math.floor(state.gameTime / 30) % list.length;

    return {
      priority: 'LOW',
      message: list[index],
      timestamp: Date.now(),
      gameTime: state.gameTime,
    };
  }

  private determineGamePhase(gameTime: number): GamePhase {
    if (gameTime < GAME_PHASES.laning.end) {
      return 'laning';
    }
    if (gameTime < GAME_PHASES.midgame.end) {
      return 'midgame';
    }
    return 'lategame';
  }

  private getActionFromWindowType(type: string): string {
    const actionMap: Record<string, string> = {
      hero_deaths: 'push',
      no_buyback: 'end_game',
      power_spike: 'group',
      creep_wave: 'push',
      ultimate_advantage: 'fight',
      aegis: 'highground',
    };

    return actionMap[type] ?? 'push';
  }

  private publish(advice: CoachingAdvice, state: ProcessedGameState): void {
    const message = this.messageFormatter.format(advice);
    const published: CoachingAdvice = { ...advice, message };

    const alert: CoachAlertPayload = {
      id: `coach-${advice.action ?? 'advice'}-${state.clockTime}-${Date.now()}`,
      message,
      type: this.mapAlertType(advice),
      audioKey: this.resolveAudioKey(advice),
    };

    this.coachGateway.sendAlert(alert);

    if (this.steamBot?.isReady()) {
      void this.steamBot.sendCoachingMessage(message);
    }

    this.lastAdvice = published;
    this.lastAlertAt = Date.now();
    this.messageQueue.markSent(published);
    this.postGameAnalyzer.recordAdvice(published);
    this.pendingAdviceId = this.trustCalibrator.registerAdvice(
      published,
      state,
    );

    this.emitStatus();
  }

  private emitStatus(): void {
    const now = Date.now();
    if (now - this.lastStatusAt < 2000) {
      return;
    }

    this.lastStatusAt = now;
    this.coachGateway.sendCoachingStatus(this.getStatus());
  }

  /**
   * اولویت کوچینگ را به قرارداد فعلی کلاینت (`info | warning | spike`) نگاشت می‌کند
   * تا قرارداد Socket.io تغییر نکند.
   */
  private mapAlertType(advice: CoachingAdvice): CoachAlertPayload['type'] {
    if (advice.priority === 'GAME_ENDING' || advice.priority === 'CRITICAL') {
      return 'warning';
    }

    if (advice.priority === 'HIGH') {
      const spikeActions = [
        'push',
        'end_game',
        'highground',
        'roshan',
        'group',
        'fight',
      ];
      return spikeActions.includes(advice.action ?? '') ? 'spike' : 'warning';
    }

    if (advice.priority === 'MEDIUM' && advice.action === 'roshan') {
      return 'spike';
    }

    return 'info';
  }

  private resolveAudioKey(advice: CoachingAdvice): string {
    const actionAudioKeys: Record<string, string> = {
      end_game: 'coach_end_game',
      push: 'coach_push',
      highground: 'coach_push',
      roshan: 'coach_roshan',
      retreat: 'coach_retreat',
      back: 'coach_retreat',
      ward: 'coach_ward',
      fight: 'coach_fight',
      group: 'coach_group',
      farm: 'coach_farm',
      save_buyback: 'coach_buyback',
    };

    if (advice.action && actionAudioKeys[advice.action]) {
      return actionAudioKeys[advice.action];
    }

    return `coach_${advice.priority.toLowerCase()}`;
  }
}
