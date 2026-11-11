// src/coaching/coaching.module.ts
import { Module } from '@nestjs/common';
import { CoachGateway } from '../coach.gateway.js';
import { CoachingController } from './coaching.controller.js';
import { AntiThrowService } from './services/anti-throw.service.js';
import { CoachingEngineService } from './services/coaching-engine.service.js';
import { CombatAnalyzerService } from './services/combat-analyzer.service.js';
import { ConfidenceCalculatorService } from './services/confidence-calculator.service.js';
import { DoNothingDetectorService } from './services/do-nothing-detector.service.js';
import { GameStateProcessorService } from './services/game-state-processor.service.js';
import { HeroSpecificAdviceService } from './services/hero-specific-advice.service.js';
import { ItemBuildAdvisorService } from './services/item-build-advisor.service.js';
import { LaningCoachService } from './services/laning-coach.service.js';
import { LategameCoachService } from './services/lategame-coach.service.js';
import { MessageFormatterService } from './services/message-formatter.service.js';
import { MessageQueueService } from './services/message-queue.service.js';
import { MidgameCoachService } from './services/midgame-coach.service.js';
import { NetWorthTrackerService } from './services/net-worth-tracker.service.js';
import { PhaseCoachingService } from './services/phase-coaching.service.js';
import { PlayerTrustCalibratorService } from './services/player-trust-calibrator.service.js';
import { PostGameAnalyzerService } from './services/post-game-analyzer.service.js';
import { PushTimingDetectorService } from './services/push-timing-detector.service.js';
import { SituationDatabaseService } from './services/situation-database.service.js';
import { WinConditionAnalyzerService } from './services/win-condition-analyzer.service.js';
import { WinrateTrackerService } from './services/winrate-tracker.service.js';
import { SteamChatBotService } from './services/steam-chat-bot.service.js';

/**
 * ماژول کوچینگ: تمام موتورهای تحلیل و توصیه را در یک مرز مشخص جمع می‌کند.
 */
@Module({
  controllers: [CoachingController],
  providers: [
    CoachGateway,
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
    SteamChatBotService,
    CoachingEngineService,
  ],
  exports: [CoachingEngineService, CoachGateway],
})
export class CoachingModule {}
