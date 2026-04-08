import type { HttpClient } from '../http';
import type { BillingInfo, Transaction } from '../types';

export interface AutoRechargeOptions {
  enabled: boolean;
  thresholdRub?: number;
  amountRub?: number;
}

export class BillingResource {
  constructor(private readonly http: HttpClient) {}

  /** Balance, pricing, and auto-recharge settings. */
  get(): Promise<BillingInfo> {
    return this.http.get<BillingInfo>('/billing');
  }

  transactions(options: { limit?: number; offset?: number } = {}): Promise<Transaction[]> {
    const { limit = 50, offset = 0 } = options;
    return this.http.get<Transaction[]>('/billing/transactions', { limit, offset });
  }

  autoRecharge(options: AutoRechargeOptions): Promise<BillingInfo> {
    const body: Record<string, unknown> = { enabled: options.enabled };
    if (options.thresholdRub !== undefined) body.threshold_rub = options.thresholdRub;
    if (options.amountRub !== undefined) body.amount_rub = options.amountRub;
    return this.http.put<BillingInfo>('/billing/auto-recharge', body);
  }
}
