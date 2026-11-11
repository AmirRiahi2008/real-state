import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Roles } from '../auth/decorators';
import { UpdateOwnProfileDto, UpdateUserAccessDto, UsersQueryDto } from './users.dto';
import { UsersService } from './users.service';

@ApiBearerAuth()
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Roles(Role.ADMIN) @Get() list(@Query() query: UsersQueryDto) {
    return this.users.list(query);
  }
  @Patch('me/profile') updateProfile(
    @Body() dto: UpdateOwnProfileDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.updateProfile(dto, actor);
  }
  @Roles(Role.ADMIN) @Patch(':id') updateAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserAccessDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.updateAccess(id, dto, actor);
  }
}
