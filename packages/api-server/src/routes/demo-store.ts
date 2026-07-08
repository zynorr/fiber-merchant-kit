import { Router, Response } from 'express';
import { z } from 'zod';
import * as db from '../db';
import { toCamelCase } from '../lib/utils';
import { createMerchantInvoice } from '../services/invoice-creation';
import { markInvoicePaid, refreshInvoiceSettlement } from '../services/invoice-settlement';

const router = Router();

const DEMO_PRODUCTS = [
  { id: 1, name: 'Cyber Widget', price: 5000 },
  { id: 2, name: 'Nervos T-Shirt', price: 100000 },
  { id: 3, name: 'Digital Art Pack', price: 25000 },
  { id: 4, name: 'Fiber Premium', price: 1000000 },
] as const;

const productById = new Map<number, (typeof DEMO_PRODUCTS)[number]>(
  DEMO_PRODUCTS.map((product) => [product.id, product]),
);

const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive().max(20),
  })).min(1).max(20),
});

function isDemoStoreCheckoutEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.DEMO_STORE_PUBLIC_CHECKOUT === 'true';
}

function isDemoSimulationEnabled(): boolean {
  return process.env.NODE_ENV !== 'production'
    && (!process.env.FIBER_NODE_RPC_URL || process.env.FIBER_NODE_RPC_URL === 'demo');
}

function getDemoMerchantId(): string {
  return db.seedDemoMerchant().id;
}

function buildOrder(items: z.infer<typeof checkoutSchema>['items']) {
  const quantities = new Map<number, number>();
  for (const item of items) {
    if (!productById.has(item.productId)) {
      throw new Error(`Unknown demo product: ${item.productId}`);
    }
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }

  const orderItems = Array.from(quantities.entries()).map(([productId, quantity]) => {
    const product = productById.get(productId)!;
    return {
      id: product.id,
      name: product.name,
      quantity,
      unitAmount: product.price,
      amount: product.price * quantity,
    };
  });

  const totalAmount = orderItems.reduce((sum, item) => sum + item.amount, 0);
  return { items: orderItems, totalAmount };
}

router.post('/checkout', async (req, res: Response) => {
  try {
    if (!isDemoStoreCheckoutEnabled()) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const parsed = checkoutSchema.parse(req.body);
    const order = buildOrder(parsed.items);
    if (order.totalAmount <= 0) {
      res.status(400).json({ error: 'Order total must be positive' });
      return;
    }

    const merchantId = getDemoMerchantId();
    const invoice = await createMerchantInvoice({
      amount: String(order.totalAmount),
      currency: 'CKB',
      description: `Demo store order: ${order.items.map((item) => `${item.name} x${item.quantity}`).join(', ')}`,
      metadata: {
        store: 'Fiber Demo Store',
        checkout: 'public-demo-store',
        items: JSON.stringify(order.items.map((item) => ({
          id: item.id,
          name: item.name,
          qty: item.quantity,
        }))),
      },
    }, merchantId);

    res.status(201).json({
      ...toCamelCase(invoice),
      order: {
        items: order.items,
        totalAmount: String(order.totalAmount),
        currency: 'CKB',
      },
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.issues });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('Unknown demo product')) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('[DemoStore] Checkout error:', message);
    res.status(500).json({ error: message });
  }
});

router.get('/invoices/:id', async (req, res: Response) => {
  try {
    if (!isDemoStoreCheckoutEnabled()) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const merchantId = getDemoMerchantId();
    const invoice = db.getInvoice(req.params.id, merchantId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    await refreshInvoiceSettlement(invoice, merchantId);
    const updated = db.getInvoice(req.params.id, merchantId);
    res.json(toCamelCase(updated!));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post('/invoices/:id/simulate-payment', (req, res: Response) => {
  try {
    if (!isDemoStoreCheckoutEnabled() || !isDemoSimulationEnabled()) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const merchantId = getDemoMerchantId();
    const invoice = db.getInvoice(req.params.id, merchantId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (invoice.status !== 'pending' && invoice.status !== 'received') {
      res.status(400).json({ error: `Cannot simulate payment for invoice with status: ${invoice.status}` });
      return;
    }

    markInvoicePaid(invoice, merchantId);
    res.json(toCamelCase(db.getInvoice(invoice.id, merchantId)!));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export { router as demoStoreRouter };
