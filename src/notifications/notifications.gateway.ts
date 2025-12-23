import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private notificationsService: NotificationsService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Notifications WebSocket Gateway initialized');
    this.logger.log(`Namespace: /notifications`);
    this.logger.log(
      `CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`,
    );
  }

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client ${client.id} attempting to connect...`);
    this.logger.debug(`Handshake: ${JSON.stringify(client.handshake.headers)}`);
    this.logger.debug(`Query: ${JSON.stringify(client.handshake.query)}`);
    this.logger.debug(`Auth: ${JSON.stringify(client.handshake.auth)}`);

    try {
      // Extract token from handshake auth or query
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(
          `Client ${client.id} disconnected: No token provided. Available sources: auth=${!!client.handshake.auth?.token}, query=${!!client.handshake.query?.token}, headers=${!!client.handshake.headers?.authorization}`,
        );
        client.disconnect();
        return;
      }

      // Verify JWT token
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        this.logger.error('JWT_SECRET not configured');
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, { secret });
      const userId = payload.sub;

      if (!userId) {
        this.logger.warn(
          `Client ${client.id} disconnected: No user ID in token`,
        );
        client.disconnect();
        return;
      }

      client.userId = userId;

      // Store connection
      this.connectedUsers.set(userId, client.id);
      this.logger.log(`Client ${client.id} connected for user ${userId}`);

      // Join user-specific room
      await client.join(`user:${userId}`);

      // Send current unread count
      const unreadCount =
        await this.notificationsService.getUnreadCount(userId);
      client.emit('unread-count', { unreadCount });
    } catch (error) {
      this.logger.error(`Client ${client.id} authentication failed:`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.connectedUsers.delete(client.userId);
      this.logger.log(
        `Client ${client.id} disconnected for user ${client.userId}`,
      );
    } else {
      this.logger.log(`Client ${client.id} disconnected`);
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) {
      return { error: 'Not authenticated' };
    }

    // User is already subscribed via room join in handleConnection
    const unreadCount = await this.notificationsService.getUnreadCount(
      client.userId,
    );

    return {
      success: true,
      unreadCount,
    };
  }

  /**
   * Send notification to a specific user via WebSocket
   */
  async sendNotificationToUser(userId: string, notification: Notification) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('new-notification', notification);
      this.server.to(`user:${userId}`).emit('new-notification', notification);

      // Update unread count
      const unreadCount =
        await this.notificationsService.getUnreadCount(userId);
      this.server.to(socketId).emit('unread-count', { unreadCount });
      this.server.to(`user:${userId}`).emit('unread-count', { unreadCount });
    }
  }

  /**
   * Broadcast notification update (e.g., when marked as read)
   */
  async notifyNotificationUpdate(userId: string, notificationId: string) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('notification-updated', { notificationId });
      this.server
        .to(`user:${userId}`)
        .emit('notification-updated', { notificationId });

      // Update unread count
      const unreadCount =
        await this.notificationsService.getUnreadCount(userId);
      this.server.to(socketId).emit('unread-count', { unreadCount });
      this.server.to(`user:${userId}`).emit('unread-count', { unreadCount });
    }
  }
}
