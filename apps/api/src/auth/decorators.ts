import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AuthUser } from './auth-user';

export const IS_PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    return context.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
  },
);
