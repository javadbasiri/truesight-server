// src/coaching/services/message-formatter.service.ts
import { Injectable } from '@nestjs/common';
import type { CoachingAdvice } from '../interfaces/coaching.interface.js';

/**
 * تنظیم لحن پیام برای موقعیت‌های پراسترس.
 * پیام‌های فارسی کوتاه، بدون جمله‌ی اضافه و با علامت هشدار مناسب ارائه می‌شوند.
 */
@Injectable()
export class MessageFormatterService {
  public format(advice: CoachingAdvice): string {
    let message = (advice.message ?? '').trim();
    if (!message) {
      return message;
    }

    message = this.applyStressFormatting(message, advice.priority);

    if (advice.confidence !== undefined && advice.confidence < 0.7) {
      message = this.softenForLowConfidence(message);
    }

    return message;
  }

  public formatTimingMessage(item: string, action: string): string {
    return `${item} آماده شد. ${action}. این دقیقاً تایمینگ توست.`;
  }

  public formatGameEndingMessage(reason: string, action: string): string {
    return `🚨 ${reason}. ${action}.`;
  }

  private applyStressFormatting(
    message: string,
    priority: CoachingAdvice['priority'],
  ): string {
    const withPunctuation = /[.!؟]$/.test(message) ? message : `${message}.`;

    if (priority === 'GAME_ENDING') {
      return `🚨 ${withPunctuation}`;
    }
    if (priority === 'CRITICAL') {
      return `⚠️ ${withPunctuation}`;
    }
    if (priority === 'HIGH') {
      return `❗ ${withPunctuation}`;
    }

    return withPunctuation;
  }

  private softenForLowConfidence(message: string): string {
    return message
      .replace(/همین حالا/g, 'احتمالاً همین حالا')
      .replace(/حتماً/g, 'بهتر است')
      .replace(/فورس کن/g, 'می‌توانی فورس کنی')
      .replace(/تمام کن/g, 'فرصت تمام کردن داری');
  }
}
