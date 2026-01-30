import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AvatarsService } from './avatars.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('avatars')
@UseGuards(JwtAuthGuard)
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  @Get()
  findAll() {
    return this.avatarsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.avatarsService.getOrThrow(id);
  }
}
