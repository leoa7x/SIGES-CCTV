import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { Kafka, Consumer } from "kafkajs";
import { createCorsOriginResolver } from "../common/cors";

interface StateChangePayload {
  entityType: string;
  entityId: string;
  oldState: string;
  newState: string;
  centerId: string;
  timestamp: string;
}

@Injectable()
@WebSocketGateway({ cors: { origin: createCorsOriginResolver() } })
export class OpsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(OpsGateway.name);
  private consumer: Consumer;

  constructor(private readonly jwtService: JwtService) {
    const kafka = new Kafka({
      clientId: "siges-gateway",
      brokers: (process.env.REDPANDA_BROKERS ?? "localhost:9092").split(","),
    });
    this.consumer = kafka.consumer({ groupId: "siges-gateway-group" });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: "siges.state-changes", fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const payload = JSON.parse(message.value.toString()) as StateChangePayload;
        this.server.to(`cmc:${payload.centerId}`).emit("state-change", payload);
      },
    });
    this.logger.log("Kafka consumer connected — listening on siges.state-changes");
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Rejected unauthenticated socket connection: ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify(token) as { sub: string; email: string; role: string };
      client.data.user = payload;
      this.logger.debug(`Client connected: ${client.id} (${payload.email})`);
    } catch {
      this.logger.warn(`Rejected socket with invalid/expired token: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribe")
  handleSubscribe(client: Socket, data: { centerId: string }) {
    if (!client.data.user) {
      client.disconnect(true);
      return;
    }
    if (typeof data?.centerId !== "string" || data.centerId.length === 0) {
      return { event: "error", data: { message: "centerId is required" } };
    }

    const room = `cmc:${data.centerId}`;
    void client.join(room);
    this.logger.debug(`Client ${client.id} joined ${room}`);
    return { event: "subscribed", data: { room } };
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.length > 0) return authToken;

    const headerAuth = client.handshake.headers.authorization;
    if (typeof headerAuth === "string" && headerAuth.startsWith("Bearer ")) {
      return headerAuth.slice("Bearer ".length);
    }

    return null;
  }
}
