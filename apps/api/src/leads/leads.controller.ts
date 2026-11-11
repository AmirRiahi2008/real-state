import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { RateLimit } from '../common/rate-limit.decorator';
import { CreateLeadDto, LeadQueryDto, UpdateLeadDto } from './leads.dto';
import { LeadsService } from './leads.service';

@ApiTags('Leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}
  @Public()
  @Post()
  @HttpCode(202)
  @RateLimit(5, 60)
  @ApiOperation({
    summary: 'Request information, a viewing, a valuation or mortgage help; never returns lead PII',
  })
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }
  @ApiBearerAuth()
  @Roles(Role.AGENT, Role.ADMIN)
  @Get()
  list(@CurrentUser() actor: AuthUser, @Query() query: LeadQueryDto) {
    return this.leads.list(actor, query);
  }
  @ApiBearerAuth()
  @Roles(Role.AGENT, Role.ADMIN)
  @Get(':id')
  one(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.leads.one(id, actor);
  }
  @ApiBearerAuth()
  @Roles(Role.AGENT, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.leads.update(id, dto, actor);
  }
}
