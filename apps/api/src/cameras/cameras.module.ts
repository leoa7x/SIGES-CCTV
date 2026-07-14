import { Module } from "@nestjs/common";
import { CamerasController } from "./cameras.controller";
import { CameraSecretService } from "./camera-secret.service";
import { CamerasService } from "./cameras.service";

@Module({ controllers: [CamerasController], providers: [CamerasService, CameraSecretService] })
export class CamerasModule {}
