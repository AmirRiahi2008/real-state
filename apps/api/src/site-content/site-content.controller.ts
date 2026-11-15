import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { SiteContentService } from './site-content.service';
@Controller('site-content')
export class SiteContentController {
  constructor(private readonly content: SiteContentService) {}
  @Public() @Get() @Header('Cache-Control', 'no-store') read() {
    return this.content.publicContent();
  }
}
