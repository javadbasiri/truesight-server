import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageQueueService } from './message-queue.service.js';
import type { CoachingAdvice } from '../interfaces/coaching.interface.js';

function advice(
  priority: CoachingAdvice['priority'],
  message = 'test',
): CoachingAdvice {
  return {
    priority,
    message,
    action: 'push',
    timestamp: Date.now(),
    gameTime: 600,
  };
}

describe('MessageQueueService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('always allows GAME_ENDING messages', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const queue = new MessageQueueService();
    queue.markSent(advice('MEDIUM'));

    expect(queue.shouldSend(advice('GAME_ENDING'))).toBe(true);
  });

  it('applies the CRITICAL cooldown', () => {
    let now = 100_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const queue = new MessageQueueService();
    expect(queue.shouldSend(advice('CRITICAL'))).toBe(true);
    queue.markSent(advice('CRITICAL'));

    now += 5_000;
    expect(queue.shouldSend(advice('CRITICAL'))).toBe(false);

    now += 30_000;
    expect(queue.shouldSend(advice('CRITICAL'))).toBe(true);
  });

  it('queues HIGH messages while rate limited and releases them later', () => {
    let now = 50_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const queue = new MessageQueueService();
    queue.markSent(advice('HIGH'));

    const queued = advice('HIGH', 'queued push window');
    now += 5_000;
    expect(queue.shouldSend(queued)).toBe(false);
    expect(queue.getNextPending()).toBeNull();

    now += 30_000;
    expect(queue.getNextPending()?.message).toBe('queued push window');
    expect(queue.getNextPending()).toBeNull();
  });

  it('keeps a bounded history and can be cleared', () => {
    const queue = new MessageQueueService();
    for (let index = 0; index < 60; index += 1) {
      queue.markSent(advice('LOW', `message-${index}`));
    }

    expect(queue.getHistory()).toHaveLength(50);
    queue.clear();
    expect(queue.getHistory()).toHaveLength(0);
    expect(queue.getLastMessageTime()).toBe(0);
  });
});
