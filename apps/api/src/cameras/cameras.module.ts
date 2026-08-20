import { Module } from "@nestjs/common";
import { CamerasController } from "./cameras.controller";
import { CameraSecretService } from "./camera-secret.service";
import { CamerasService } from "./cameras.service";
import { CameraHeartbeatScheduler } from "./camera-heartbeat-scheduler.service";
import { HeartbeatModule } from "../heartbeat/heartbeat.module";

@Module({ imports: [HeartbeatModule], controllers: [CamerasController], providers: [CamerasService, CameraSecretService, CameraHeartbeatScheduler], exports: [CamerasService] })
export class CamerasModule {}
