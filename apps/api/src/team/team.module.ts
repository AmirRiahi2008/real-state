import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { TeamController } from './team.controller';
import { TeamConversationsService } from './team-conversations.service';
import { TeamProfilesService } from './team-profiles.service';

@Module({
  imports: [MediaModule],
  controllers: [TeamController],
  providers: [TeamProfilesService, TeamConversationsService],
  exports: [TeamConversationsService],
})
export class TeamModule {}
