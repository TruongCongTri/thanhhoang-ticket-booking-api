/**
 * Interceptor này chạy sau Guards.
 * Khi JwtAuthGuard xác thực thành công và gán thông tin vào request.user,
 * Interceptor lập tức đồng bộ đối tượng này vào RequestContextService.
 * Kể từ thời điểm này, mọi Service, Helper, TypeORM Subscriber bên dưới
 * đều có thể lấy userId, tenantId, rules mà không cần chạm vào request object.
 *
 * Lưu ý: Guard chạy TRƯỚC interceptor, vì vậy các guard cần user (PermissionsGuard)
 * phải tự gọi syncUserFromRequest().
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContextService } from './request-context.service';
import { RequestUserContext } from './request-context.model';

/**
 * Đồng bộ request.user (do Passport/JwtAuthGuard gán) vào AsyncLocalStorage.
 * Trả về user hiệu lực (ưu tiên request.user).
 */
export function syncUserFromRequest(
  context: ExecutionContext,
  contextService: RequestContextService,
): RequestUserContext | undefined {
  if (context.getType() !== 'http') {
    return contextService.getCurrentUser();
  }
  const request = context.switchToHttp().getRequest();
  const user: RequestUserContext | undefined = request?.user;
  if (user && contextService.getCurrentUser() !== user) {
    contextService.setUser(user);
  }
  return user ?? contextService.getCurrentUser();
}

@Injectable()
export class RequestContextSyncInterceptor implements NestInterceptor {
  constructor(private readonly contextService: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    syncUserFromRequest(context, this.contextService);
    return next.handle();
  }
}
