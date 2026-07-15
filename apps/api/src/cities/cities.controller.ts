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
import { CitiesService, CreateCityDto, UpdateCityDto } from "./cities.service";

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("cities")
export class CitiesController {
  constructor(private service: CitiesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions(Permission.MANAGE_ORG)
  @Post()
  create(@Body() dto: CreateCityDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(Permission.MANAGE_ORG)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCityDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(Permission.MANAGE_ORG)
  @Post(":id/logo")
  @UseInterceptors(FileInterceptor("logo"))
  uploadLogo(
    @Param("id") id: string,
    @UploadedFile() file: MulterFile,
  ) {
    return this.service.uploadLogo(id, file.buffer, file.mimetype);
  }
}
