import { Controller, Get, Header, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";
import { CameraPreviewService } from "./camera-preview.service";

type AuthenticatedRequest = Request & { user: { id: string } };

@UseGuards(AuthGuard("jwt"))
@Controller("cameras")
export class CameraPreviewController {
  constructor(private readonly preview: CameraPreviewService) {}

  @Post(":id/preview/start")
  @Header("Cache-Control", "no-store, private")
  start(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.preview.startPreview(id, req.user.id);
  }

  @Get("preview/:sessionId/status")
  @Header("Cache-Control", "no-store, private")
  status(@Param("sessionId") sessionId: string, @Req() req: AuthenticatedRequest) {
    return this.preview.getPreviewStatus(sessionId, req.user.id);
  }

  @Post("preview/:sessionId/stop")
  @Header("Cache-Control", "no-store, private")
  stop(@Param("sessionId") sessionId: string, @Req() req: AuthenticatedRequest) {
    return this.preview.stopPreview(sessionId, req.user.id);
  }

  @Get("preview/:sessionId/media")
  @Header("Cache-Control", "no-store, private")
  media(@Param("sessionId") sessionId: string, @Req() req: AuthenticatedRequest, @Res() res: Response): void {
    const stream = this.preview.getMediaStream(sessionId, req.user.id);
    res.setHeader("Content-Type", "multipart/x-mixed-replace; boundary=siges-preview");
    stream.pipe(res);
  }
}
