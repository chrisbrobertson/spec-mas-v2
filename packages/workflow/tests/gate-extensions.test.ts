import { describe, expect, it } from 'vitest';
import { GateExtensionRegistry } from '../src/extensions.js';

describe('gate extension registry', () => {
  it('registers and evaluates extension gates', () => {
    const registry = new GateExtensionRegistry();
    registry.register({
      gateId: 'X1',
      contractVersion: '1.0',
      evaluate(context) {
        return {
          gateId: 'X1',
          passed: context.semanticsPass,
          message: 'custom gate'
        };
      }
    });

    const result = registry.evaluate('X1', {
      structurePass: true,
      semanticsPass: false,
      traceabilityPass: true,
      determinismPass: true
    });

    expect(result.passed).toBe(false);
    expect(registry.listGateIds()).toEqual(['X1']);
  });

  it('rejects unsupported contract versions', () => {
    const registry = new GateExtensionRegistry();
    expect(() =>
      registry.register({
        gateId: 'X2',
        contractVersion: '2.0' as '1.0',
        evaluate() {
          return {
            gateId: 'X2',
            passed: true,
            message: 'bad'
          };
        }
      })
    ).toThrow('Unsupported gate extension contract version');
  });

  it('fails when extension is missing', () => {
    const registry = new GateExtensionRegistry();
    expect(() =>
      registry.evaluate('MISSING', {
        structurePass: true,
        semanticsPass: true,
        traceabilityPass: true,
        determinismPass: true
      })
    ).toThrow('Gate extension "MISSING" is not registered');
  });
});
