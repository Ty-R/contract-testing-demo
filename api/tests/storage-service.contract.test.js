const { PactV3, MatchersV3 } = require('@pact-foundation/pact');
const request = require('supertest');

const { like } = MatchersV3;
const app = require('../app');

const provider = new PactV3({
  consumer: 'api',
  provider: 'storage-service'
});

describe('GET /storage/item/:id', () => {
  it('returns the item', () => {
    provider
      .uponReceiving('a request for an item')
      .withRequest({
        method: 'GET',
        path: '/storage/item/123'
      })
      .willRespondWith({
        status: 200,
        body: {
          id: like(1),
          name: like('string'),
          description: like('string'),
        }
      });

    return provider.executeTest(async (mockserver) => {
      process.env.STORAGE_SERVICE_URL = mockserver.url;
      await request(app).get('/api/item/123');

      // Add any additional assertions here. Useful for if the consumer is
      // doing anything with the responses
    });
  });
});

describe('POST /storage/item', () => {
  it('returns the ID of the new item', () => {
    provider
      .uponReceiving('a request to create an item')
      .withRequest({
        method: 'POST',
        path: '/storage/item',
        body: {
          name: 'A new item',
          description: 'A new example item.'
        }
      })
      .willRespondWith({
        status: 201,
        body: {
          id: like(1),
          status: 'success'
        }
      });

    return provider.executeTest(async (mockserver) => {
      process.env.STORAGE_SERVICE_URL = mockserver.url;
      await request(app)
        .post('/api/item')
        .send({
          name: 'A new item',
          description: 'A new example item.'
        });
    });
  });
});
