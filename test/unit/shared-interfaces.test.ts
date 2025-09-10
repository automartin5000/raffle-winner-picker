/**
 * @jest-environment node
 */

import type { ServiceConfig } from '../../src/lib/domain-constants';
import type {
  UrlBuilderProps,
  ApiUrlBuilderProps,
} from '../../src/lib/shared-interfaces';

describe('Shared Interfaces', () => {
  describe('UrlBuilderProps interface', () => {
    test('should accept objects with envName and hostedZone', () => {
      const props: UrlBuilderProps = {
        envName: 'dev',
        hostedZone: 'example.com',
      };

      expect(props.envName).toBe('dev');
      expect(props.hostedZone).toBe('example.com');
    });

    test('should require both envName and hostedZone properties', () => {
      // This test validates TypeScript compilation - the interface requires both properties
      const validProps: UrlBuilderProps = {
        envName: 'prod',
        hostedZone: 'rafflewinnerpicker.com',
      };

      expect(validProps).toHaveProperty('envName');
      expect(validProps).toHaveProperty('hostedZone');
    });

    test('should work with different environment names', () => {
      const environments = ['dev', 'prod', 'local', 'pr123'];
      const hostedZone = 'test.com';

      environments.forEach(envName => {
        const props: UrlBuilderProps = {
          envName,
          hostedZone,
        };

        expect(props.envName).toBe(envName);
        expect(props.hostedZone).toBe(hostedZone);
      });
    });

    test('should work with different hosted zones', () => {
      const envName = 'dev';
      const hostedZones = [
        'rafflewinnerpicker.com',
        'dev.rafflewinnerpicker.com',
        'test.example.com',
        'localhost',
      ];

      hostedZones.forEach(hostedZone => {
        const props: UrlBuilderProps = {
          envName,
          hostedZone,
        };

        expect(props.envName).toBe(envName);
        expect(props.hostedZone).toBe(hostedZone);
      });
    });
  });

  describe('ApiUrlBuilderProps interface', () => {
    test('should extend UrlBuilderProps with service property', () => {
      const mockService: ServiceConfig = {
        subdomain: 'api.winners',
        name: 'Raffle Winners Service',
      };

      const props: ApiUrlBuilderProps = {
        envName: 'dev',
        hostedZone: 'example.com',
        service: mockService,
      };

      expect(props.envName).toBe('dev');
      expect(props.hostedZone).toBe('example.com');
      expect(props.service).toBe(mockService);
    });

    test('should work with different service configurations', () => {
      const services: ServiceConfig[] = [
        { subdomain: 'api.winners', name: 'Raffle Winners Service' },
        { subdomain: 'api.auth', name: 'Authentication Service' },
        { subdomain: 'api.notifications', name: 'Notification Service' },
      ];

      services.forEach(service => {
        const props: ApiUrlBuilderProps = {
          envName: 'prod',
          hostedZone: 'rafflewinnerpicker.com',
          service,
        };

        expect(props.service).toBe(service);
        expect(props.service.subdomain).toBe(service.subdomain);
        expect(props.service.name).toBe(service.name);
      });
    });

    test('should require all three properties: envName, hostedZone, and service', () => {
      const mockService: ServiceConfig = {
        subdomain: 'api.test',
        name: 'Test Service',
      };

      const validProps: ApiUrlBuilderProps = {
        envName: 'local',
        hostedZone: 'localhost',
        service: mockService,
      };

      expect(validProps).toHaveProperty('envName');
      expect(validProps).toHaveProperty('hostedZone');
      expect(validProps).toHaveProperty('service');
    });

    test('should work with complex service configurations', () => {
      const complexService: ServiceConfig = {
        subdomain: 'api.complex-service-name',
        name: 'Complex Multi-Word Service Name',
      };

      const props: ApiUrlBuilderProps = {
        envName: 'pr123',
        hostedZone: 'dev.rafflewinnerpicker.com',
        service: complexService,
      };

      expect(props.service.subdomain).toBe('api.complex-service-name');
      expect(props.service.name).toBe('Complex Multi-Word Service Name');
    });
  });

  describe('Interface compatibility', () => {
    test('should allow ApiUrlBuilderProps to be used where UrlBuilderProps is expected', () => {
      const mockService: ServiceConfig = {
        subdomain: 'api.test',
        name: 'Test Service',
      };

      const apiProps: ApiUrlBuilderProps = {
        envName: 'dev',
        hostedZone: 'example.com',
        service: mockService,
      };

      // This should work because ApiUrlBuilderProps extends UrlBuilderProps
      const urlProps: UrlBuilderProps = apiProps;

      expect(urlProps.envName).toBe('dev');
      expect(urlProps.hostedZone).toBe('example.com');
    });

    test('should maintain type safety for service property', () => {
      const service: ServiceConfig = {
        subdomain: 'api.winners',
        name: 'Raffle Winners Service',
      };

      const props: ApiUrlBuilderProps = {
        envName: 'prod',
        hostedZone: 'rafflewinnerpicker.com',
        service,
      };

      // Should have all the properties of both interfaces
      expect(typeof props.envName).toBe('string');
      expect(typeof props.hostedZone).toBe('string');
      expect(typeof props.service).toBe('object');
      expect(typeof props.service.subdomain).toBe('string');
      expect(typeof props.service.name).toBe('string');
    });
  });
});