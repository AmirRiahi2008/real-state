import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request>();
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = String(res.getHeader('X-Request-Id') ?? '');
    let status = 500;
    let message: string | string[] = 'An unexpected error occurred';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? error.message);
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        status = 409;
        message = 'A record with these identifiers already exists';
      } else if (error.code === 'P2025') {
        status = 404;
        message = 'Resource not found';
      } else if (error.code === 'P2003') {
        status = 409;
        message = 'A related resource is unavailable or the record is in use';
      } else if (error.code === 'P2034') {
        status = 409;
        message = 'Concurrent update; please retry';
      }
    } else if (error instanceof SyntaxError) {
      status = 400;
      message = 'Malformed request';
    } else if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      status = 413;
      message = 'Request body is too large';
    }
    if (status >= 500)
      this.logger.error(
        JSON.stringify({
          event: 'request_failed',
          requestId,
          errorType: error instanceof Error ? error.name : 'unknown',
        }),
      );
    res.status(status).json({
      statusCode: status,
      message,
      requestId,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
  }
}
