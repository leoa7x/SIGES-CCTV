import { Module } from "@nestjs/common";
import { CamerasModule } from "../cameras/cameras.module";
import { FfmpegPreviewAdapter } from "./ffmpeg-preview.adapter";
import { CameraPreviewController } from "./camera-preview.controller";
import { CameraPreviewService } from "./camera-preview.service";

@Module({
  imports: [CamerasModule],
  controllers: [CameraPreviewController],
  providers: [CameraPreviewService, { provide: "CameraPreviewAdapter", useClass: FfmpegPreviewAdapter }],
})
export class CameraPreviewModule {}
