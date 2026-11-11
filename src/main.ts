// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  // بایند کردن مستقیم روی لوکال‌هاست برای جلوگیری از تداخل با VPN
  await app.listen(4000, '127.0.0.1');
  console.log('TrueSight GSI Server is running on http://127.0.0.1:4000');
}
void bootstrap();
