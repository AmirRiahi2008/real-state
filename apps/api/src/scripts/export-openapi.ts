import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../app.module';
import { setupApp } from '../common/setup-app';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  try {
    setupApp(app, false);
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('UAE Real Estate API')
        .setVersion('1.0.0')
        .setDescription(
          'AED decimal strings, square metres, explicit English/Arabic fields. See docs/api-guide.md for permissions and session flow.',
        )
        .addBearerAuth()
        .build(),
    );
    const directory = resolve('../../docs');
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
    console.log('Exported docs/openapi.json');
  } finally {
    await app.close();
  }
}
void main().catch(() => {
  console.error('OpenAPI export failed. Verify the API configuration.');
  process.exitCode = 1;
});
