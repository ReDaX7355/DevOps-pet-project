import request from 'supertest';
import app from '../../src/server';

describe('API /health', () => {
  test('GET /health возвращает 200', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body.status).toBe('OK');
    expect(response.body.timestamp).toBeDefined();
  });
});
