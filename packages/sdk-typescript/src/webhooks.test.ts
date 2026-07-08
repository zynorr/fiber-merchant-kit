import { describe, expect, it } from 'vitest';
import { constructWebhookEvent, verifyWebhookSignature } from './webhooks';

describe('webhook signature helpers', () => {
  const payload = '{"id":"evt_1"}';
  const secret = 'whsec_test';
  const signature = '030fa3b2413d1993c551364bd53bb9b3edb5c0c34d55dba6ada6041245632811';

  it('verifies a valid Fiber webhook signature', async () => {
    await expect(verifyWebhookSignature(payload, signature, secret)).resolves.toBe(true);
  });

  it('accepts a sha256= signature prefix', async () => {
    await expect(verifyWebhookSignature(payload, `sha256=${signature}`, secret)).resolves.toBe(true);
  });

  it('rejects an invalid Fiber webhook signature', async () => {
    await expect(verifyWebhookSignature(payload, 'bad-signature', secret)).resolves.toBe(false);
  });

  it('constructs a verified webhook event from a raw body string', async () => {
    const event = await constructWebhookEvent<{ id: string }>(payload, signature, secret);
    expect(event.id).toBe('evt_1');
  });

  it('throws when constructing an event with an invalid signature', async () => {
    await expect(constructWebhookEvent(payload, 'bad-signature', secret)).rejects.toThrow(
      'Invalid webhook signature',
    );
  });
});
