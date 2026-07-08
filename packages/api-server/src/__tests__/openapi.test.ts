import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Operation = {
  operationId?: string;
};

type PathItem = Partial<Record<'get' | 'post' | 'patch' | 'delete', Operation>>;

type OpenApiSpec = {
  openapi: string;
  info: {
    title: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
};

const expectedOperations: Array<[path: string, method: keyof PathItem, operationId: string]> = [
  ['/', 'get', 'getServerIndex'],
  ['/api/v1', 'get', 'getApiDiscovery'],
  ['/api/v1/health', 'get', 'getHealth'],
  ['/api/v1/demo-store/checkout', 'post', 'createDemoStoreCheckout'],
  ['/api/v1/demo-store/invoices/{id}', 'get', 'getDemoStoreInvoice'],
  ['/api/v1/demo-store/invoices/{id}/simulate-payment', 'post', 'simulateDemoStorePayment'],
  ['/api/v1/auth/me', 'get', 'getAuthContext'],
  ['/api/v1/auth/api-key/rotate', 'post', 'rotateApiKey'],
  ['/api/v1/invoices', 'post', 'createInvoice'],
  ['/api/v1/invoices', 'get', 'listInvoices'],
  ['/api/v1/invoices/{id}', 'get', 'getInvoice'],
  ['/api/v1/invoices/{id}/cancel', 'post', 'cancelInvoice'],
  ['/api/v1/invoices/{id}/simulate-payment', 'post', 'simulateInvoicePayment'],
  ['/api/v1/invoices/{id}/refund', 'post', 'refundInvoice'],
  ['/api/v1/invoices/{id}/qr', 'get', 'getInvoiceQr'],
  ['/api/v1/webhooks', 'post', 'createWebhook'],
  ['/api/v1/webhooks', 'get', 'listWebhooks'],
  ['/api/v1/webhooks/delivery-worker/status', 'get', 'getWebhookDeliveryWorkerStatus'],
  ['/api/v1/webhooks/delivery-worker/run', 'post', 'runWebhookDeliveryWorker'],
  ['/api/v1/webhooks/{id}', 'get', 'getWebhook'],
  ['/api/v1/webhooks/{id}', 'patch', 'updateWebhook'],
  ['/api/v1/webhooks/{id}', 'delete', 'deleteWebhook'],
  ['/api/v1/webhooks/{id}/deliveries', 'get', 'listWebhookDeliveries'],
  ['/api/v1/webhooks/{id}/deliveries/{deliveryId}/retry', 'post', 'retryWebhookDelivery'],
  ['/api/v1/webhooks/{id}/test', 'post', 'sendWebhookTest'],
  ['/api/v1/transactions', 'get', 'listTransactions'],
  ['/api/v1/transactions/{id}', 'get', 'getTransaction'],
  ['/api/v1/balance/channels', 'get', 'listChannelBalances'],
  ['/api/v1/balance/total', 'get', 'getTotalBalance'],
  ['/api/v1/fiber/status', 'get', 'getFiberStatus'],
  ['/api/v1/fiber/settlement/run', 'post', 'runSettlementSweep'],
  ['/api/v1/stats', 'get', 'getStats'],
  ['/api/v1/stats/revenue', 'get', 'getRevenueHistory'],
];

const httpMethods = ['get', 'post', 'patch', 'delete'] as const;

function getSpecPath() {
  const candidates = [
    path.resolve(process.cwd(), 'docs/openapi.json'),
    path.resolve(process.cwd(), '../../docs/openapi.json'),
  ];
  const specPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!specPath) {
    throw new Error(`Could not find docs/openapi.json from ${process.cwd()}`);
  }

  return specPath;
}

function readSpec(): OpenApiSpec {
  return JSON.parse(fs.readFileSync(getSpecPath(), 'utf8')) as OpenApiSpec;
}

describe('OpenAPI contract', () => {
  it('documents every public, invoice, webhook, and merchant API operation', () => {
    const spec = readSpec();

    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe('Fiber Merchant Kit API');
    expect(spec.components?.securitySchemes?.BearerAuth).toBeDefined();

    for (const [route, method, operationId] of expectedOperations) {
      expect(spec.paths[route]?.[method]?.operationId).toBe(operationId);
    }
  });

  it('uses unique operation IDs for generated SDK and client tooling', () => {
    const spec = readSpec();
    const operationIds = Object.values(spec.paths).flatMap((pathItem) =>
      httpMethods
        .map((method) => pathItem[method]?.operationId)
        .filter((operationId): operationId is string => Boolean(operationId))
    );

    expect(operationIds).toHaveLength(expectedOperations.length);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });
});
