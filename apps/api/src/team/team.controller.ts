import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { PaginationDto } from '../common/pagination.dto';
import { RateLimit } from '../common/rate-limit.decorator';
import { TeamConversationsService } from './team-conversations.service';
import { TeamProfilesService } from './team-profiles.service';
import {
  ConversationMessageDto,
  CreateTeamConversationDto,
  TeamMessageQueryDto,
  UpdateTeamProfileDto,
} from './team.dto';

@ApiTags('Team and private conversations')
@Controller('team')
export class TeamController {
  constructor(
    private readonly profiles: TeamProfilesService,
    private readonly conversations: TeamConversationsService,
  ) {}

  @Public()
  @Get('members')
  members() {
    return this.profiles.list();
  }

  @Public()
  @Get('members/:slug')
  member(@Param('slug') slug: string) {
    return this.profiles.publicMember(slug);
  }

  @Get('me')
  @Roles(Role.TEAM_MEMBER, Role.ADMIN)
  @ApiBearerAuth()
  me(@CurrentUser() actor: AuthUser) {
    return this.profiles.own(actor);
  }

  @Patch('me')
  @Roles(Role.TEAM_MEMBER, Role.ADMIN)
  @ApiBearerAuth()
  @RateLimit(20, 60)
  update(@CurrentUser() actor: AuthUser, @Body() dto: UpdateTeamProfileDto) {
    return this.profiles.updateOwn(actor, dto);
  }

  @Post('me/photo')
  @Roles(Role.TEAM_MEMBER, Role.ADMIN)
  @ApiBearerAuth()
  @RateLimit(5, 60)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
      fileFilter: (_request, file, callback) =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
          ? callback(null, true)
          : callback(new BadRequestException('Unsupported image type'), false),
    }),
  )
  photo(@CurrentUser() actor: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    return this.profiles.uploadPhoto(actor, file);
  }

  @Public()
  @Post('conversations')
  @RateLimit(3, 60)
  createConversation(@Body() dto: CreateTeamConversationDto) {
    return this.conversations.create(dto);
  }

  @Public()
  @Get('conversations/:id')
  @RateLimit(120, 60)
  @ApiHeader({
    name: 'X-Conversation-Token',
    required: true,
    description: 'Private receipt returned only when this conversation was created.',
  })
  conversation(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Headers('x-conversation-token') token: string | undefined,
    @Query() query: TeamMessageQueryDto,
  ) {
    return this.conversations.visitorThread(id, token, query);
  }

  @Public()
  @Post('conversations/:id/messages')
  @RateLimit(10, 60)
  @ApiHeader({ name: 'X-Conversation-Token', required: true })
  visitorMessage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Headers('x-conversation-token') token: string | undefined,
    @Body() dto: ConversationMessageDto,
  ) {
    return this.conversations.visitorMessage(id, token, dto);
  }

  @Get('inbox')
  @Roles(Role.TEAM_MEMBER, Role.ADMIN)
  @ApiBearerAuth()
  inbox(@CurrentUser() actor: AuthUser, @Query() query: PaginationDto) {
    return this.conversations.inbox(actor, query);
  }

  @Get('inbox/:id')
  @Roles(Role.TEAM_MEMBER, Role.ADMIN)
  @ApiBearerAuth()
  thread(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: TeamMessageQueryDto,
  ) {
    return this.conversations.staffThread(actor, id, query);
  }

  @Post('inbox/:id/replies')
  @Roles(Role.TEAM_MEMBER, Role.ADMIN)
  @ApiBearerAuth()
  @RateLimit(30, 60)
  reply(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ConversationMessageDto,
  ) {
    return this.conversations.reply(actor, id, dto);
  }
}
