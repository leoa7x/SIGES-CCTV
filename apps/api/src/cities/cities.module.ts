import { Module } from "@nestjs/common";
import { CitiesController } from "./cities.controller";
import { CitiesService } from "./cities.service";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [StorageModule],
  controllers: [CitiesController],
  providers: [CitiesService],
})
export class CitiesModule {}
