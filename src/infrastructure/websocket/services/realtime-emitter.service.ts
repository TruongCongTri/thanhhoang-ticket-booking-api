import { Injectable, Logger } from '@nestjs/common';
import { AppEventsGateway } from '../gateways/app-events.gateway';

@Injectable()
export class RealtimeEmitterService {
  private readonly logger = new Logger(RealtimeEmitterService.name);

  constructor(private readonly gateway: AppEventsGateway) {}

  /**
   * Phát thông báo tới toàn bộ người dùng thuộc 1 Tenant (Đa cụm Pod qua Redis)
   */
  emitToTenant(tenantId: string, event: string, data: any): void {
    this.gateway.server.to(`tenant:${tenantId}`).emit(event, data);
    this.logger.debug(`[Realtime Broadcast] Sent '${event}' to tenant '${tenantId}'`);
  }

  /**
   * Bắn thông báo trực tiếp tới 1 User cụ thể trên tất cả thiết bị của họ
   */
  emitToUser(userId: string, event: string, data: any): void {
    this.gateway.server.to(`user:${userId}`).emit(event, data);
    this.logger.debug(`[Realtime P2P] Sent '${event}' to user '${userId}'`);
  }

  /**
   * Bắn cập nhật tới một phòng nghiệp vụ (ví dụ phòng chuyến bay: flight:VN123)
   */
  emitToRoom(room: string, event: string, data: any): void {
    this.gateway.server.to(room).emit(event, data);
  }
}