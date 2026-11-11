/**
 * قراردادهای موتور کوچینگ TrueSight.
 * تمام پیام‌های کاربری به زبان فارسی و با اصطلاحات رایج دوتا ۲ نوشته می‌شوند.
 */

export type MessagePriority =
  'GAME_ENDING' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type WinCondition =
  | 'earlyPush'
  | 'timingPush'
  | 'splitPush'
  | 'highgroundSiege'
  | 'outscale'
  | 'unknown';

export type GamePhase = 'laning' | 'midgame' | 'lategame';

export interface VisualAid {
  type: 'arrow' | 'circle' | 'ping' | 'line';
  color: 'green' | 'red' | 'yellow' | 'blue';
  startPos?: number[];
  endPos?: number[];
  centerPos?: number[];
  radius?: number;
  path?: number[][];
  repeats?: number;
}

export interface NetWorthContext {
  delta: number;
  deltaPercent: number;
}

export interface CoachingAdvice {
  priority: MessagePriority;
  message: string;
  action?: string;
  visualAid?: VisualAid;
  timestamp: number;
  gameTime: number;
  confidence?: number;
  confidenceReasons?: string[];
  isDoNothing?: boolean;
  netWorthContext?: NetWorthContext;
}

export interface PushWindow {
  type:
    | 'hero_deaths'
    | 'no_buyback'
    | 'power_spike'
    | 'creep_wave'
    | 'ultimate_advantage'
    | 'aegis';
  priority: MessagePriority;
  duration?: number;
  message: string;
  lanes?: string[];
  timestamp: number;
}

export interface PowerSpike {
  type: 'level' | 'item' | 'hero_specific' | 'roshan';
  description: string;
  timing: number;
  duration?: number;
  completed: boolean;
}

export interface WinConditionAnalysis {
  primaryCondition: WinCondition;
  confidence: number;
  timing: string;
  strategy: string;
  heroes: string[];
  keyItems: string[];
  pushTiming: number;
}

export interface NetWorthAnalysis {
  teamNetWorth: number;
  enemyNetWorth: number;
  delta: number;
  deltaPercent: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  recommendation: string;
  signals: string[];
}

export interface ConfidenceFactors {
  dataCompleteness: number;
  visionCertainty: number;
  timingPrecision: number;
  netWorthReliability: number;
}

export interface ConfidenceResult {
  score: number;
  factors: ConfidenceFactors;
  reasons: string[];
}

export type ComplianceState =
  | 'full_compliance'
  | 'partial_compliance'
  | 'ambiguous_compliance'
  | 'no_compliance'
  | 'delayed_compliance';

export interface ComplianceRecord {
  adviceId: string;
  advice: CoachingAdvice;
  timestamp: number;
  gameTime: number;
  followed: boolean;
  complianceState: ComplianceState;
  outcome: 'positive' | 'negative' | 'neutral' | 'unknown';
  timeToComply?: number;
  certainty: number;
}

export interface TrustMetrics {
  complianceRate: number;
  positiveOutcomeRate: number;
  averageResponseTime: number;
  verbosityLevel: 'high' | 'medium' | 'low';
  explanationLevel: 'detailed' | 'standard' | 'minimal';
}

export type GameEventType =
  | 'push_window'
  | 'back_opportunity'
  | 'decisive_moment'
  | 'throw_warning'
  | 'objective_taken';

export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  gameTime: number;
  description: string;
  severity: 'high' | 'medium' | 'low';
  adviceGiven?: string;
  outcome?: 'taken' | 'missed' | 'unknown';
  confidence?: number;
  netWorthContext?: NetWorthContext;
  weight?: number;
}

export interface PostGameSummary {
  gameDuration: number;
  events: GameEvent[];
  missedPushWindows: GameEvent[];
  missedBackOpportunities: GameEvent[];
  decisiveMoments: GameEvent[];
  recommendations: string[];
  confidenceWeightedAnalysis: {
    highConfidenceMissed: number;
    lowConfidenceMissed: number;
    highConfidenceTaken: number;
    averageConfidence: number;
  };
}

export interface DoNothingState {
  detected: boolean;
  reason: string;
  confidence: number;
  duration: number;
}

export interface CoachingStatus {
  inGame: boolean;
  matchId: string;
  clockTime: number;
  gamePhase: GamePhase;
  winCondition: WinConditionAnalysis | null;
  netWorth: NetWorthAnalysis | null;
  trustMetrics: TrustMetrics;
  lastAdvice: CoachingAdvice | null;
  lastAlertAt: number | null;
}
