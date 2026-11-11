import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachGateway } from '../../coach.gateway.js';
import { CoachingEngineService } from './coaching-engine.service.js';
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
import { WinrateTrackerService } from './winrate-tracker.service.js';
import { createGsiPayload } from '../testing/game-state.fixture.js';

describe('CoachingEngineService', () => {
  let engine: CoachingEngineService;
  const gateway = {
    sendAlert: vi.fn(),
    sendGameState: vi.fn(),
    sendCoachingStatus: vi.fn(),
    sendPostGameSummary: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GameStateProcessorService,
        WinConditionAnalyzerService,
        NetWorthTrackerService,
        CombatAnalyzerService,
        LaningCoachService,
        MidgameCoachService,
        LategameCoachService,
        SituationDatabaseService,
        AntiThrowService,
        PushTimingDetectorService,
        PhaseCoachingService,
        ItemBuildAdvisorService,
        HeroSpecificAdviceService,
        DoNothingDetectorService,
        ConfidenceCalculatorService,
        MessageQueueService,
        MessageFormatterService,
        PlayerTrustCalibratorService,
        PostGameAnalyzerService,
        WinrateTrackerService,
        CoachingEngineService,
        { provide: CoachGateway, useValue: gateway },
      ],
    }).compile();

    engine = moduleRef.get(CoachingEngineService);
  });

  it('ignores ticks outside of an active game', () => {
    const payload = createGsiPayload(0);
    payload.map!.game_state = 'DOTA_GAMERULES_STATE_HERO_SELECTION';

    expect(engine.processTick(payload)).toBeNull();
    expect(gateway.sendAlert).not.toHaveBeenCalled();
  });

  it('emits a well-formed coach alert for the 20 minute Aegis window', () => {
    const advice = engine.processTick(createGsiPayload(1200));

    expect(advice).not.toBeNull();
    expect(gateway.sendAlert).toHaveBeenCalledTimes(1);

    const alert = gateway.sendAlert.mock.calls[0][0];
    expect(alert.id.startsWith('coach-')).toBe(true);
    expect(typeof alert.message).toBe('string');
    expect(alert.message).toContain('آیجیس');
    expect(['info', 'warning', 'spike']).toContain(alert.type);
    expect(typeof alert.audioKey).toBe('string');
  });

  it('evaluates at most once per game second', () => {
    const payload = createGsiPayload(1200);

    engine.processTick(payload);
    const second = engine.processTick({ ...payload });

    expect(second).toBeNull();
    expect(gateway.sendAlert).toHaveBeenCalledTimes(1);
  });

  it('publishes a coaching-status snapshot', () => {
    engine.processTick(createGsiPayload(1200));

    expect(gateway.sendCoachingStatus).toHaveBeenCalled();
    const status = gateway.sendCoachingStatus.mock.calls[0][0];
    expect(status.inGame).toBe(true);
    expect(status.matchId).toBe('1001');
    expect(status.gamePhase).toBe('midgame');
    expect(status.trustMetrics.complianceRate).toBe(0.5);
  });

  it('produces a post-game summary when the match ends', () => {
    engine.processTick(createGsiPayload(1200));

    const payload = createGsiPayload(1500);
    payload.map!.game_state = 'DOTA_GAMERULES_STATE_POST_GAME';

    expect(engine.processTick(payload)).toBeNull();
    expect(gateway.sendPostGameSummary).toHaveBeenCalledTimes(1);

    const summaryPayload = gateway.sendPostGameSummary.mock.calls[0][0];
    expect(summaryPayload.text).toContain('تحلیل بعد از بازی');
    expect(summaryPayload.summary.gameDuration).toBe(1500);
    expect(engine.getPostGameSummary()).not.toBeNull();
  });

  it('resets its state on demand', () => {
    engine.processTick(createGsiPayload(1200));
    engine.reset();

    const status = engine.getStatus();
    expect(status.matchId).toBe('');
    expect(status.lastAdvice).toBeNull();
    expect(status.inGame).toBe(false);
  });
});
