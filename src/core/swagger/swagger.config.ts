/**
 * OpenAPI / Swagger:
 *  - Bật/tắt và đường dẫn theo cấu hình (SWAGGER_ENABLED, SWAGGER_PATH); mặc định tắt trên production.
 *  - Tài liệu tách theo đối tượng: /docs (internal, đầy đủ), /docs/client, /docs/partner.
 *  - JSON spec cho sinh SDK tự động: /docs-json, /docs/client-json, /docs/partner-json.
 */
import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppConfigService } from '../config/app-config.service';
import { TENANT_HEADER } from '../multitenancy/tenancy.constants';
import { API_AUDIENCE_EXTENSION, ApiAudienceType } from './api-audience.decorator';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

/** Lọc tài liệu chỉ giữ operation dành cho audience (operation không gắn audience = internal) */
export function filterDocumentByAudience(document: OpenAPIObject, audience: ApiAudienceType): OpenAPIObject {
  const paths: OpenAPIObject['paths'] = {};
  for (const [path, item] of Object.entries(document.paths)) {
    const filtered: Record<string, unknown> = {};
    for (const method of HTTP_METHODS) {
      const operation = (item as Record<string, any>)[method];
      if (!operation) continue;
      const audiences: ApiAudienceType[] = operation[API_AUDIENCE_EXTENSION] ?? ['internal'];
      if (audiences.includes(audience)) filtered[method] = operation;
    }
    if (Object.keys(filtered).length > 0) {
      paths[path] = { ...(item as object), ...filtered } as OpenAPIObject['paths'][string];
      for (const method of HTTP_METHODS) {
        if (!(method in filtered)) delete (paths[path] as Record<string, unknown>)[method];
      }
    }
  }
  return { ...document, paths };
}

export class SwaggerConfigHelper {
  static setup(app: INestApplication, config: AppConfigService): void {
    const { enabled, path } = config.swagger;
    if (!enabled) return;

    const builder = new DocumentBuilder()
      .setTitle('Travel Enterprise Booking API')
      .setDescription('Production-safe REST API specification for Travel Booking & Payment Services')
      .setVersion(config.app.version)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addGlobalParameters({
        name: TENANT_HEADER,
        in: 'header',
        required: false,
        description: 'Tenant UUID (bắt buộc với tài khoản đa tenant / SUPER_ADMIN chuyển tenant)',
        schema: { type: 'string', format: 'uuid' },
      })
      .addTag('Bookings', 'Flight and hotel reservation endpoints')
      .addTag('Payments', 'Payment processing & status hooks');

    const document = SwaggerModule.createDocument(app, builder.build());
    const options = { swaggerOptions: { persistAuthorization: true } };

    SwaggerModule.setup(path, app, document, { ...options, jsonDocumentUrl: `${path}-json` });
    for (const audience of ['client', 'partner'] as const) {
      SwaggerModule.setup(`${path}/${audience}`, app, filterDocumentByAudience(document, audience), {
        ...options,
        jsonDocumentUrl: `${path}/${audience}-json`,
      });
    }

    new Logger('Swagger').log(`OpenAPI docs available at /${path} (client: /${path}/client, partner: /${path}/partner)`);
  }
}
