import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { Kafka, Consumer } from "kafkajs";

interface StateChangePayload {
  entityType: string;
  entityId: string;
  oldState: string;
  newState: string;
  centerId: string;
  timestamp: string;
}

@Injectable()
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:3001" } })
export class OpsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(OpsGateway.name);
  private consumer: Consumer;

  constructor() {
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
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribe")
  handleSubscribe(client: Socket, data: { centerId: string }) {
    const room = `cmc:${data.centerId}`;
    void client.join(room);
    this.logger.debug(`Client ${client.id} joined ${room}`);
    return { event: "subscribed", data: { room } };
  }
}
