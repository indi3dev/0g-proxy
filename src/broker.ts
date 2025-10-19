import { ZGComputeNetworkBroker, createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import { JsonRpcProvider, Wallet } from 'ethers';

interface BrokerConfig {
  privateKey: string;
  zgChainRpc: string;
}

interface ProviderInfo {
  address: string;
  endpoint: string;
  model: string;
}

class BrokerManager {
  private broker: ZGComputeNetworkBroker | null = null;
  private config: BrokerConfig;
  private providerCache: ProviderInfo | null = null;
  private initialized: boolean = false;

  constructor(config: BrokerConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('Initializing 0G broker...');

    const provider = new JsonRpcProvider(this.config.zgChainRpc);
    const signer = new Wallet(this.config.privateKey, provider);

    this.broker = await createZGComputeNetworkBroker(signer);

    this.initialized = true;
    console.log('Broker initialized successfully');
  }

  async getProvider(providerAddressOrModel: string): Promise<ProviderInfo> {
    if (!this.broker) {
      throw new Error('Broker not initialized');
    }

    // Check if it's a provider address (starts with 0x)
    const isAddress = providerAddressOrModel.startsWith('0x');

    if (isAddress) {
      // Direct provider address specified
      const providerAddress = providerAddressOrModel;

      // Return cached provider if address matches
      if (this.providerCache && this.providerCache.address.toLowerCase() === providerAddress.toLowerCase()) {
        return this.providerCache;
      }

      console.log(`Using provider address: ${providerAddress}`);

      // Check if user has acknowledged this provider
      const acknowledged = await this.broker.inference.userAcknowledged(providerAddress);
      if (!acknowledged) {
        console.log('Acknowledging provider signer...');
        await this.broker.inference.acknowledgeProviderSigner(providerAddress);
        console.log('Provider acknowledged');
      }

      // Get provider information
      const providerInfo = await this.broker.inference.getServiceMetadata(providerAddress);

      // Cache the provider
      this.providerCache = {
        address: providerAddress,
        endpoint: providerInfo.endpoint,
        model: providerInfo.model,
      };

      return this.providerCache;
    } else {
      // Model name specified - scan for providers
      const model = providerAddressOrModel;

      // Return cached provider if model matches
      if (this.providerCache && this.providerCache.model === model) {
        return this.providerCache;
      }

      console.log(`Discovering providers for model: ${model}...`);

      // List all services
      const services = await this.broker.inference.listService();

      if (!services || services.length === 0) {
        throw new Error('No providers available');
      }

      // Find provider with the requested model
      const selectedProvider = services.find((s: any) => s.model === model);

      if (!selectedProvider) {
        throw new Error(`No provider found for model: ${model}`);
      }

      console.log(`Selected provider: ${selectedProvider.provider}`);

      // Check if user has acknowledged this provider
      const acknowledged = await this.broker.inference.userAcknowledged(selectedProvider.provider);
      if (!acknowledged) {
        console.log('Acknowledging provider signer...');
        await this.broker.inference.acknowledgeProviderSigner(selectedProvider.provider);
        console.log('Provider acknowledged');
      }

      // Get provider information
      const providerInfo = await this.broker.inference.getServiceMetadata(selectedProvider.provider);

      // Cache the provider
      this.providerCache = {
        address: selectedProvider.provider,
        endpoint: providerInfo.endpoint,
        model: providerInfo.model,
      };

      return this.providerCache;
    }
  }

  async getRequestHeaders(providerAddress: string, content: string): Promise<Record<string, string>> {
    if (!this.broker) {
      throw new Error('Broker not initialized');
    }

    const headers = await this.broker.inference.getRequestHeaders(
      providerAddress,
      content
    );

    return headers as unknown as Record<string, string>;
  }

  async processResponse(providerAddress: string, content: string): Promise<void> {
    if (!this.broker) {
      throw new Error('Broker not initialized');
    }

    try {
      await this.broker.inference.processResponse(providerAddress, content);
      console.log(`Processed response and settled fees for provider: ${providerAddress}`);
    } catch (error: any) {
      console.log(`Response processing: ${error.message}`);
    }
  }

  getBroker(): ZGComputeNetworkBroker {
    if (!this.broker) {
      throw new Error('Broker not initialized');
    }
    return this.broker;
  }
}

let brokerManagerInstance: BrokerManager | null = null;

export function initializeBrokerManager(config: BrokerConfig): BrokerManager {
  if (!brokerManagerInstance) {
    brokerManagerInstance = new BrokerManager(config);
  }
  return brokerManagerInstance;
}

export function getBrokerManager(): BrokerManager {
  if (!brokerManagerInstance) {
    throw new Error('BrokerManager not initialized. Call initializeBrokerManager first.');
  }
  return brokerManagerInstance;
}

export { BrokerManager, BrokerConfig, ProviderInfo };
