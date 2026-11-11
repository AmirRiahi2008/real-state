import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceRepository } from './workspace.repository';
import { WorkspaceService } from './workspace.service';
@Module({
  imports: [ListingsModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceRepository, WorkspaceService],
})
export class WorkspaceModule {}
