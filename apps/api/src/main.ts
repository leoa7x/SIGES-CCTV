import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module";
import { createCorsOriginResolver } from "./common/cors";
import { requireEnv } from "./common/env";

function validateProductionRuntime() {
  if (process.env.SIGES_STRICT_PRODUCTION !== "true") return;

  for (const name of [
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "CAMERA_SECRET_KEY",
    "MONITOR_API_TOKEN",
    "NETWORK_TELEMETRY_INGEST_TOKEN",
    "LAN_DISCOVERY_AGENT_TOKEN",
    "POSTGRES_PASSWORD",
    "MINIO_PASSWORD",
  ]) requireEnv(name);

  if (process.env.DISCOVERY_ALLOW_MOCK === "true") {
    throw new Error("DISCOVERY_ALLOW_MOCK=true is forbidden in production");
  }
  if (!process.env.LAN_ORANGUTAN_CMD?.trim()) {
    throw new Error("LAN_ORANGUTAN_CMD is required in production");
  }
}

async function bootstrap() {
  validateProductionRuntime();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: createCorsOriginResolver(),
    credentials: true,
  });

  app.useWebSocketAdapter(new IoAdapter(app));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle("SIGES-CCTV API")
    .setDescription("Sistema Integral de Gestión Operacional CCTV")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));

  const port = process.env.API_PORT ?? 4001;
  await app.listen(port, "0.0.0.0");
  console.log(`SIGES-CCTV API running on port ${port}`);
}

bootstrap();
