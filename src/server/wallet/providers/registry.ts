import { PaymentVerificationProvider } from './types';
import { VerifyEtProvider } from './verifyEt';
import { paymentProviderConfigs } from '../store';
import { PaymentProviderConfig } from '../../../types/wallet';

export class PaymentProviderRegistry {
  private providers = new Map<string, PaymentVerificationProvider>();
  private fallbackProviderId = process.env.DEFAULT_PAYMENT_PROVIDER || 'verify_et';

  constructor() {
    this.register(new VerifyEtProvider());
  }

  register(provider: PaymentVerificationProvider): void {
    this.providers.set(provider.id, provider);
    if (!paymentProviderConfigs.has(provider.id)) {
      paymentProviderConfigs.set(provider.id, {
        providerId: provider.id,
        name: provider.name,
        isEnabled: true,
        isDefault: provider.id === this.fallbackProviderId,
        isConfigured: provider.isConfigured(),
        supportedMethods: provider.supportedMethods,
        environment: provider.isConfigured() ? 'live' : 'sandbox',
        updatedAt: Date.now(),
      });
    }
  }

  get(providerId?: string): PaymentVerificationProvider | undefined {
    if (providerId) {
      return this.providers.get(providerId);
    }
    return this.getDefault();
  }

  getProvider(providerId?: string): PaymentVerificationProvider | undefined {
    return this.get(providerId);
  }

  getActiveProviderForMethod(method: string = 'telebirr'): {
    provider: PaymentVerificationProvider | undefined;
    config: PaymentProviderConfig | undefined;
  } {
    // Prefer default enabled provider supporting the requested method
    const configs = this.listConfigs();
    const defaultMatch = configs.find(
      (c) => c.isEnabled && c.isDefault && c.supportedMethods.includes(method)
    );
    const enabledMatch =
      defaultMatch || configs.find((c) => c.isEnabled && c.supportedMethods.includes(method));

    if (!enabledMatch) {
      return { provider: undefined, config: undefined };
    }
    return {
      provider: this.providers.get(enabledMatch.providerId),
      config: enabledMatch,
    };
  }

  getDefault(): PaymentVerificationProvider {
    const configs = this.listConfigs();
    const defaultCfg = configs.find((c) => c.isEnabled && c.isDefault) || configs.find((c) => c.isEnabled);
    const id = defaultCfg?.providerId || this.fallbackProviderId;
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Default payment provider '${id}' not found.`);
    }
    return provider;
  }

  updateConfig(providerId: string, updates: { isEnabled?: boolean; isDefault?: boolean }): PaymentProviderConfig | null {
    const provider = this.providers.get(providerId);
    if (!provider) return null;

    const existing = paymentProviderConfigs.get(providerId) || {
      providerId: provider.id,
      name: provider.name,
      isEnabled: true,
      isDefault: false,
      isConfigured: provider.isConfigured(),
      supportedMethods: provider.supportedMethods,
      environment: provider.isConfigured() ? ('live' as const) : ('sandbox' as const),
      updatedAt: Date.now(),
    };

    if (updates.isDefault) {
      for (const [id, cfg] of paymentProviderConfigs.entries()) {
        paymentProviderConfigs.set(id, { ...cfg, isDefault: id === providerId, updatedAt: Date.now() });
      }
      existing.isDefault = true;
    }

    if (typeof updates.isEnabled === 'boolean') {
      existing.isEnabled = updates.isEnabled;
    }

    existing.isConfigured = provider.isConfigured();
    existing.environment = provider.isConfigured() ? 'live' : 'sandbox';
    existing.updatedAt = Date.now();
    paymentProviderConfigs.set(providerId, existing);
    return existing;
  }

  listConfigs(): PaymentProviderConfig[] {
    return Array.from(this.providers.values()).map((p) => {
      const persisted = paymentProviderConfigs.get(p.id);
      return {
        providerId: p.id,
        name: p.name,
        isEnabled: persisted ? persisted.isEnabled : true,
        isDefault: persisted ? persisted.isDefault : p.id === this.fallbackProviderId,
        isConfigured: p.isConfigured(),
        supportedMethods: p.supportedMethods,
        environment: p.isConfigured() ? ('live' as const) : ('sandbox' as const),
        updatedAt: persisted?.updatedAt || Date.now(),
      };
    });
  }

  listProviders(): PaymentProviderConfig[] {
    return this.listConfigs();
  }
}

export const paymentProviderRegistry = new PaymentProviderRegistry();
