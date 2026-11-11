// src/coaching/services/message-queue.service.ts
import { Injectable } from '@nestjs/common';
import type {
  CoachingAdvice,
  MessagePriority,
} from '../interfaces/coaching.interface.js';
import {
  CRITICAL_COOLDOWN_MS,
  RATE_LIMITS,
} from '../config/coaching.constants.js';

/**
 * صف پیام با Rate Limit بر اساس اولویت.
 * پیام‌های GAME_ENDING هرگز بلاک نمی‌شوند؛ پیام‌های HIGH در صف انتظار می‌مانند.
 */
@Injectable()
export class MessageQueueService {
  private lastMessageTime = 0;
  private messageHistory: CoachingAdvice[] = [];
  private pendingMessages: CoachingAdvice[] = [];

  public shouldSend(advice: CoachingAdvice): boolean {
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastMessageTime;

    if (advice.priority === 'GAME_ENDING') {
      return true;
    }

    if (advice.priority === 'CRITICAL') {
      return timeSinceLastMessage >= CRITICAL_COOLDOWN_MS;
    }

    const rateLimit = this.getRateLimit(advice.priority);
    if (timeSinceLastMessage < rateLimit) {
      if (advice.priority === 'HIGH') {
        this.pendingMessages.push(advice);
        if (this.pendingMessages.length > 20) {
          this.pendingMessages.shift();
        }
      }
      return false;
    }

    return true;
  }

  public markSent(advice: CoachingAdvice): void {
    this.lastMessageTime = Date.now();
    this.messageHistory.push(advice);

    if (this.messageHistory.length > 50) {
      this.messageHistory.shift();
    }

    this.pendingMessages = this.pendingMessages.filter(
      (message) => message !== advice,
    );
  }

  public getNextPending(): CoachingAdvice | null {
    if (this.pendingMessages.length === 0) {
      return null;
    }

    const nextMessage = this.pendingMessages[0];
    const timeSinceLastMessage = Date.now() - this.lastMessageTime;

    if (timeSinceLastMessage >= this.getRateLimit(nextMessage.priority)) {
      this.pendingMessages.shift();
      return nextMessage;
    }

    return null;
  }

  public clear(): void {
    this.messageHistory = [];
    this.pendingMessages = [];
    this.lastMessageTime = 0;
  }

  public getHistory(): CoachingAdvice[] {
    return [...this.messageHistory];
  }

  public getLastMessageTime(): number {
    return this.lastMessageTime;
  }

  private getRateLimit(priority: MessagePriority): number {
    return RATE_LIMITS[priority] ?? RATE_LIMITS.LOW;
  }
}
