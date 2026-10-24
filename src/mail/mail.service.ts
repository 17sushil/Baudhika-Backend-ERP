import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendOtp(to: string, code: string, ttlMinutes: number) {
    if (process.env.MAIL_DRIVER !== 'console') {
      throw new Error('No mail provider configured');
    }
    // DEV ONLY: replace with a real provider (SES, Resend, SMTP...) later.
    this.logger.warn(`[DEV MAIL] OTP for ${to}: ${code} (valid ${ttlMinutes} min)`);
  }
}