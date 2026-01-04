import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot from 'node-telegram-bot-api';
import { Order } from '../orders/entities/order.entity';

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private bot: TelegramBot | null = null;

  constructor(private configService: ConfigService) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (botToken) {
      try {
        this.bot = new TelegramBot(botToken, { polling: false });
        this.logger.log('Telegram bot initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize Telegram bot', error);
      }
    } else {
      this.logger.warn('TELEGRAM_BOT_TOKEN not found in environment variables');
    }
  }

  async sendOrderNotification(chatId: string, order: Order): Promise<boolean> {
    if (!this.bot) {
      this.logger.warn('Telegram bot not initialized, skipping notification');
      return false;
    }

    if (!chatId) {
      this.logger.warn('Telegram chat ID not provided, skipping notification');
      return false;
    }

    try {
      const message = this.formatOrderMessage(order);
      // Convert chatId to number if it's a numeric string (Telegram API accepts both)
      const numericChatId = /^\d+$/.test(chatId)
        ? parseInt(chatId, 10)
        : chatId;

      this.logger.log(
        `Attempting to send Telegram notification to chat ${numericChatId} for order ${order.orderNumber}`,
      );
      await this.bot.sendMessage(numericChatId, message, {
        parse_mode: 'HTML',
      });
      this.logger.log(
        `✅ Order notification sent successfully to Telegram chat ${numericChatId}`,
      );
      return true;
    } catch (error: any) {
      // Enhanced error logging
      const errorMessage =
        error?.response?.description || error?.message || 'Unknown error';
      const errorCode = error?.response?.error_code || 'N/A';

      this.logger.error(
        `❌ Failed to send Telegram notification to chat ${chatId} for order ${order.orderNumber}`,
      );
      this.logger.error(`   Error Code: ${errorCode}`);
      this.logger.error(`   Error Message: ${errorMessage}`);

      // Common error messages
      if (errorMessage.includes('chat not found') || errorCode === 400) {
        this.logger.error(
          '   ⚠️  User may not have started the bot. Tell them to send /start to the bot first.',
        );
      } else if (errorMessage.includes('Forbidden') || errorCode === 403) {
        this.logger.error('   ⚠️  Bot is blocked by user or bot was deleted.');
      }

      return false;
    }
  }

  private formatOrderMessage(order: Order): string {
    const itemsList = order.items
      .map(
        (item) =>
          `  • ${item.productName} x${item.quantity} - ${parseFloat(item.price.toString()).toFixed(2)} MKD`,
      )
      .join('\n');

    const shippingAddress = order.shippingAddress;
    const addressText = `${shippingAddress.street}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}, ${shippingAddress.country}`;

    // Determine emoji and title based on status
    let emoji = '🛒';
    let title = 'New Order Received!';

    if (order.status === 'cancelled') {
      emoji = '❌';
      title = 'Order Cancelled';
    } else if (order.status === 'returned') {
      emoji = '↩️';
      title = 'Order Returned';
    }

    // Build status explanation section if present
    let explanationSection = '';
    if (
      (order.status === 'cancelled' || order.status === 'returned') &&
      order.statusExplanation
    ) {
      explanationSection = `\n<b>Reason:</b> ${order.statusExplanation}\n`;
    }

    return `
<b>${emoji} ${title}</b>

<b>Order Number:</b> ${order.orderNumber}
<b>Total Amount:</b> ${parseFloat(order.totalAmount.toString()).toFixed(2)} MKD
<b>Status:</b> ${order.status}${explanationSection}
<b>Customer:</b>
  Name: ${order.customer?.name || 'N/A'}
  Email: ${order.customer?.email || 'N/A'}
  Phone: ${shippingAddress.phone || 'N/A'}

<b>Items:</b>
${itemsList}

<b>Shipping Address:</b>
${addressText}

<b>Order Date:</b> ${new Date(order.createdAt).toLocaleString()}
    `.trim();
  }
}
