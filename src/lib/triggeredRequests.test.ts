import { describe, expect, it } from 'vitest';
import { filterAndShortenTriggeredRequests } from './triggeredRequests';

describe('filterAndShortenTriggeredRequests', () => {
  it('keeps API calls to the app and its sibling API host, not assets or third parties', () => {
    const requests = [
      { url: 'https://app.x.com/assets/chunk.js', method: '', type: 'script' },
      { url: 'https://app.x.com/logo.png', method: '', type: 'img' },
      { url: 'https://www.google-analytics.com/collect', method: '', type: 'fetch' },
      { url: 'https://api.x.com/orders?page=1', method: '', type: 'fetch' },
      { url: 'https://app.x.com/api/me', method: '', type: 'xmlhttprequest' },
    ];

    const kept = filterAndShortenTriggeredRequests(requests, 'app.x.com');

    expect(kept.map(r => r.url)).toEqual(['api.x.com/orders', '/api/me']);
    // The exporter filters again; already-shortened URLs must survive that pass
    expect(filterAndShortenTriggeredRequests(kept, 'app.x.com').map(r => r.url)).toEqual(['api.x.com/orders', '/api/me']);
  });

  it('does not treat every site under a bare TLD as the same backend', () => {
    const kept = filterAndShortenTriggeredRequests(
      [{ url: 'https://other.com/api', method: '', type: 'fetch' }],
      'x.com',
    );
    expect(kept).toEqual([]);
  });
});
