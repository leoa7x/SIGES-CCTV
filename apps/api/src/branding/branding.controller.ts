import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";

import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { BrandingService, CreateBrandingProfileDto, UpdateBrandingProfileDto } from "./branding.service";

interface MulterFile {
  mimetype: string;
  buffer: Buffer;
}

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@RequirePermissions(Permission.MANAGE_ORG)
@Controller("branding-profiles")
export class BrandingController {
  constructor(private readonly service: BrandingService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBrandingProfileDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBrandingProfileDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/logo")
  @UseInterceptors(FileInterceptor("logo"))
  uploadLogo(@Param("id") id: string, @UploadedFile() file: MulterFile) {
    return this.service.uploadLogo(id, file.buffer, file.mimetype);
  }
}
