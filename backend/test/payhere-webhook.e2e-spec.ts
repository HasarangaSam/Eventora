import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { vi } from 'vitest';
import { PayHereWebhookController } from '../src/payments/payments.controller.js';
import { PaymentsService } from '../src/payments/payments.service.js';

describe('PayHere notification route', () => {
  let app: INestApplication<App>;
  const payments = { handleNotification: vi.fn().mockResolvedValue({ received: true }) };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayHereWebhookController],
      providers: [{ provide: PaymentsService, useValue: payments }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => app.close());

  it('accepts PayHere application/x-www-form-urlencoded fields and acknowledges with 200', async () => {
    const fields = {
      merchant_id: '1234567',
      order_id: 'EVT-test-order',
      payment_id: 'provider-payment-1',
      payhere_amount: '125.40',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: 'A'.repeat(32),
    };
    await request(app.getHttpServer())
      .post('/api/webhooks/payhere/notify')
      .type('form')
      .send(fields)
      .expect(200)
      .expect({ received: true });
    expect(payments.handleNotification).toHaveBeenCalledWith(fields);
  });
});
