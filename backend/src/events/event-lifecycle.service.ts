import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EventLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventLifecycleService.name);
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<number> | undefined;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.completeEndedEvents().catch(() => this.logger.error('Event completion batch failed')), 60_000);
    this.timer.unref();
    void this.completeEndedEvents().catch(() => this.logger.error('Initial event completion batch failed'));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  completeEndedEvents() {
    if (this.running) return this.running;
    this.running = this.prisma.event.updateMany({
      where: { status: 'PUBLISHED', endAt: { lte: new Date() } },
      data: { status: 'COMPLETED' },
    }).then(({ count }) => count).finally(() => { this.running = undefined; });
    return this.running;
  }
}
