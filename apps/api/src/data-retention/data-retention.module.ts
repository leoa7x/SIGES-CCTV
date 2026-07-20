import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { DataRetentionScheduler } from "./data-retention-scheduler.service";

@Module({
  imports: [PrismaModule],
  providers: [DataRetentionScheduler],
})
export class DataRetentionModule {}
