import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor, MulterModule } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { AuthUser } from '../auth/auth-user';
import { RateLimit } from '../common/rate-limit.decorator';
import { PaginationDto } from '../common/pagination.dto';
import { ImageStorage, LocalImageStorage } from './image-storage';
import { MediaService } from './media.service';
@ApiTags('Media')
@Controller('media')
class MediaController {
  constructor(private readonly media: MediaService) {}
  @Post()
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiBearerAuth()
  @RateLimit(10)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    return this.media.upload(user, file);
  }
  @Get('manage/mine')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiBearerAuth()
  mine(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.media.mine(user, q);
  }
  @Get('manage/:id/file')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiBearerAuth()
  async managedFile(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const { stream, size } = await this.media.managedFile(user, id);
    return new StreamableFile(stream, {
      type: 'image/webp',
      disposition: 'inline; filename="property.webp"',
      length: size,
    });
  }
  @Public() @Get(':id/file') async file(@Param('id', ParseUUIDPipe) id: string) {
    const { stream, size } = await this.media.publicFile(id);
    return new StreamableFile(stream, {
      type: 'image/webp',
      disposition: 'inline; filename="property.webp"',
      length: size,
    });
  }
  @Delete(':id')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.media.remove(user, id);
  }
}
@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize: config.getOrThrow<number>('MAX_UPLOAD_BYTES'),
          files: 1,
          fields: 0,
          parts: 1,
        },
        fileFilter: (_req, file, cb) =>
          ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
            ? cb(null, true)
            : cb(new BadRequestException('Unsupported image type'), false),
      }),
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService, { provide: ImageStorage, useClass: LocalImageStorage }],
})
export class MediaModule {}
