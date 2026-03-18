import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<Request>();

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: any =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    this.logger.error(
      `HTTP ${status} ${request['method']} ${request['url']}: ${
        exception instanceof Error ? exception.message : message
      }`,
    );

    // Normalize message shape
    if (typeof message === 'string') {
      message = { message };
    }

    response.status(status).json({
      statusCode: status,
      path: request['url'],
      timestamp: new Date().toISOString(),
      ...message,
    });
  }
}

