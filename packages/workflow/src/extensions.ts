import type { GateContext, GateFinding } from './gates.js';

export interface GateExtension {
  gateId: string;
  contractVersion: '1.0';
  evaluate(context: GateContext): GateFinding;
}

export class GateExtensionRegistry {
  private readonly extensions = new Map<string, GateExtension>();

  register(extension: GateExtension): void {
    if (extension.contractVersion !== '1.0') {
      throw new Error(`Unsupported gate extension contract version "${extension.contractVersion}"`);
    }
    if (this.extensions.has(extension.gateId)) {
      throw new Error(`Gate extension "${extension.gateId}" is already registered`);
    }
    this.extensions.set(extension.gateId, extension);
  }

  evaluate(gateId: string, context: GateContext): GateFinding {
    const extension = this.extensions.get(gateId);
    if (!extension) {
      throw new Error(`Gate extension "${gateId}" is not registered`);
    }

    return extension.evaluate(context);
  }

  listGateIds(): string[] {
    return [...this.extensions.keys()].sort();
  }
}
