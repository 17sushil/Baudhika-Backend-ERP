import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const dataSource = { query: jest.fn() };

  beforeEach(async () => {
    dataSource.query.mockReset();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DataSource, useValue: dataSource }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('GET / returns service info', () => {
    expect(appController.getInfo()).toEqual({ service: 'erp-backend', status: 'ok' });
  });

  it('GET /health reports the database up', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    await expect(appController.getHealth()).resolves.toMatchObject({ status: 'ok', database: 'up' });
  });

  it('GET /health throws 503 when the database is down', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));
    await expect(appController.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
