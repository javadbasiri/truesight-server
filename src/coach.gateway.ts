// src/coach.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import {
  CoachAlertPayload,
  GameStatePayload,
} from './gsi/interfaces/gsi-payload.interface.js';
import type {
  CoachingStatus,
  PostGameSummary,
} from './coaching/interfaces/coaching.interface.js';

export interface PostGameSummaryPayload {
  text: string;
  summary: PostGameSummary;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class CoachGateway {
  @WebSocketServer()
  server: Server;

  sendAlert(alertData: CoachAlertPayload): void {
    this.server.emit('coach-alert', alertData);
  }

  /** ارسال خلاصه‌ی وضعیت بازی برای داشبورد کلاینت */
  sendGameState(gameState: GameStatePayload): void {
    this.server.emit('game-state', gameState);
  }

  /** وضعیت زنده‌ی موتور کوچینگ (شرط برد، فاز بازی، ارزش خالص، اعتماد) */
  sendCoachingStatus(status: CoachingStatus): void {
    this.server.emit('coaching-status', status);
  }

  /** تحلیل بعد از بازی */
  sendPostGameSummary(payload: PostGameSummaryPayload): void {
    this.server.emit('post-game-summary', payload);
  }
}
