// src/coaching/services/steam-chat-bot.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createRequire } from 'node:module';

type CoachMeHandler = (steamId: string) => void;

/**
 * تحویل اختیاری توصیه‌ها از طریق چت استیم (پورت‌شده از `steamBot` پروژه‌ی مرجع).
 * این سرویس فقط زمانی فعال می‌شود که `STEAM_USERNAME` و `STEAM_PASSWORD`
 * تنظیم شده و پکیج اختیاری `steam-user` نصب باشد؛ در غیر این صورت
 * کانال اصلی (Socket.io overlay) بدون هیچ اختلالی کار می‌کند.
 */
@Injectable()
export class SteamChatBotService {
  private readonly logger = new Logger(SteamChatBotService.name);
  private readonly nodeRequire = createRequire(import.meta.url);
  private steamUser: any = null;
  private activeSteamId: string | null = null;
  private coachMeHandler: CoachMeHandler | null = null;

  constructor() {
    const username = process.env.STEAM_USERNAME;
    const password = process.env.STEAM_PASSWORD;

    if (!username || !password) {
      this.logger.log(
        'Steam credentials not provided - Steam chat delivery disabled',
      );
      return;
    }

    this.connect(username, password);
  }

  public onCoachMe(handler: CoachMeHandler): void {
    this.coachMeHandler = handler;
  }

  public setActiveSteamId(steamId: string | null): void {
    this.activeSteamId = steamId;
  }

  public isReady(): boolean {
    return this.steamUser !== null;
  }

  public sendChatMessage(steamId: string, message: string): boolean {
    if (!this.steamUser) {
      return false;
    }

    try {
      this.steamUser.chatMessage(steamId, message);
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to send Steam message: ${(error as Error).message}`,
      );
      return false;
    }
  }

  public async sendCoachingMessage(message: string): Promise<boolean> {
    if (!this.activeSteamId) {
      return false;
    }

    return this.sendChatMessage(this.activeSteamId, message);
  }

  public disconnect(): void {
    if (!this.steamUser) {
      return;
    }

    try {
      this.steamUser.logOff();
    } catch (error) {
      this.logger.warn(
        `Failed to log off Steam bot: ${(error as Error).message}`,
      );
    }

    this.steamUser = null;
    this.activeSteamId = null;
  }

  private connect(username: string, password: string): void {
    try {
      const SteamUser = this.nodeRequire('steam-user');
      const client = new SteamUser();
      const onlineState = SteamUser.EPersonaState?.Online ?? 1;
      const friendRequestState =
        SteamUser.EFriendRelationship?.RequestRecipient ?? 2;

      client.on('loggedOn', () => {
        client.setPersona(onlineState);
        this.logger.log(`Steam chat bot logged in as ${username}`);
      });

      client.on(
        'friendRelationship',
        (steamId: unknown, relationship: number) => {
          if (relationship === friendRequestState) {
            client.addFriend(steamId);
          }
        },
      );

      client.on('friendMessage', (steamId: unknown, message: string) => {
        if (
          typeof message !== 'string' ||
          !message.toLowerCase().includes('coach me')
        ) {
          return;
        }

        const steamIdString = String(steamId);
        this.activeSteamId = steamIdString;
        this.coachMeHandler?.(steamIdString);
        this.sendChatMessage(
          steamIdString,
          'TrueSight Coach فعال شد! بازی را شروع کن تا توصیه‌ها را دریافت کنی.',
        );
      });

      client.logOn({ accountName: username, password });
      this.steamUser = client;
    } catch {
      this.steamUser = null;
      this.logger.warn(
        'Optional package "steam-user" is not installed. Run `npm i steam-user` to enable Steam chat delivery.',
      );
    }
  }
}
