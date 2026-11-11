import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupApp } from './common/setup-app';
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  try {
    setupApp(app);
    const config = app.get(ConfigService);
    await app.listen(config.getOrThrow<number>('PORT'), config.getOrThrow<string>('HOST'));
    Logger.log(`API listening on port ${config.get<number>('PORT')}`, 'Bootstrap');
  } catch (error) {
    await app.close();
    throw error;
  }
}
void bootstrap().catch(() => {
  Logger.error(
    'Startup failed. Check configuration and database/Redis availability. Credentials were not logged.',
    'Bootstrap',
  );
  process.exitCode = 1;
});
