// src/coach.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { CoachAlertPayload } from './gsi/interfaces/gsi-payload.interface.js';

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
}