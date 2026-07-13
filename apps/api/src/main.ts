import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module";
import { createCorsOriginResolver } from "./common/cors";

async function bootstrap() {
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
