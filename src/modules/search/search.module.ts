import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import * as http from 'http';
import * as https from 'https';
import { SearchController } from './controllers/search.controller';
import { FlightAggregatorService } from './services/flight-aggregator.service';
import { FareNormalizationService } from './services/fare-normalization.service';
import { SearchCacheService } from './services/search-cache.service';
import { SabreAdapter } from './adapters/aviation/sabre.adapter';
import { AmadeusAdapter } from './adapters/aviation/amadeus.adapter';
import { VietjetAdapter } from './adapters/aviation/vietjet.adapter';
import { AirAsiaAdapter } from './adapters/aviation/airasia.adapter';
import { HotelbedsAdapter } from './adapters/hotel/hotelbeds.adapter';
import { AgodaAdapter } from './adapters/hotel/agoda.adapter';
import { HotelAggregatorService } from './services/hotel-aggregator.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 8000,
      maxRedirects: 3,
      httpAgent: new http.Agent({ keepAlive: true, maxSockets: 100 }),
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 100 }),
    }),
  ],
  controllers: [SearchController],
  providers: [
    FlightAggregatorService,
    HotelAggregatorService,
    FareNormalizationService,
    SearchCacheService,
    SabreAdapter,
    AmadeusAdapter,
    VietjetAdapter,
    AirAsiaAdapter,
    HotelbedsAdapter,
    AgodaAdapter,
  ],
  exports: [
    FlightAggregatorService,
    HotelAggregatorService,
    FareNormalizationService,
    SabreAdapter,
    AmadeusAdapter,
    VietjetAdapter,
    AirAsiaAdapter,
    HotelbedsAdapter,
    AgodaAdapter,
  ],
})
export class SearchModule {}