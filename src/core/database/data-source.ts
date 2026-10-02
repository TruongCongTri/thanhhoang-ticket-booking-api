/**
 * DataSource cho TypeORM CLI (migration:run / migration:revert / migration:generate).
 * Migration được chạy bởi Kubernetes Job/InitContainer trước khi rollout Pod API,
 * tránh race-condition & table lock khi nhiều Pod cùng boot.
 *
 *   npm run migration:run
 */
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { config as loadDotenv } from 'dotenv';
import { validateEnv } from '../config/env.schema';
import { AppConfigService } from '../config/app-config.service';
import { buildDataSourceOptions } from './database.options';

loadDotenv({ path: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'], quiet: true });

const appConfig = new AppConfigService(new ConfigService(validateEnv(process.env)));

export default new DataSource({
  ...buildDataSourceOptions(appConfig),
  entities: [`${__dirname}/../../**/*.entity.{ts,js}`],
});
