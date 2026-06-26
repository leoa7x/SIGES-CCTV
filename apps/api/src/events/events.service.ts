import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Kafka, Producer } from "kafkajs";

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private producer: Producer;

  constructor() {
    const kafka = new Kafka({
      clientId: "siges-api",
      brokers: (process.env.REDPANDA_BROKERS ?? "localhost:9092").split(","),
    });
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
    this.logger.log("Kafka producer connected");
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publish(topic: string, payload: object): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
  }
}
