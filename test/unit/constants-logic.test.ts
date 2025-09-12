/**
 * @jest-environment node
 */

describe('Constants Logic Tests', () => {
  const mockImportMetaEnv = {
    VITE_AUTH0_CLIENT_ID: 'fallback_client_id',
    VITE_SPA_AUTH0_CLIENT_ID: 'spa_client_id',
    VITE_AUTH0_CLIENT_ID_DEV: 'dev_client_id',
    VITE_AUTH0_CLIENT_ID_PROD: 'prod_client_id',
    nonprod_hosted_zone: 'dev.rafflewinnerpicker.com',
    prod_hosted_zone: 'rafflewinnerpicker.com',
  };

  describe('Hostname matching logic', () => {
    test('should correctly identify production hostnames', () => {
      const productionHostnames = [
        'rafflewinnerpicker.com',
        'www.rafflewinnerpicker.com',
      ];

      productionHostnames.forEach(hostname => {
        const isNonProd = hostname.endsWith(mockImportMetaEnv.nonprod_hosted_zone);
        const isProduction = !isNonProd && hostname.endsWith(mockImportMetaEnv.prod_hosted_zone);

        expect(isNonProd).toBe(false);
        expect(isProduction).toBe(true);
      });
    });

    test('should correctly identify non-production hostnames', () => {
      const nonProdHostnames = [
        'dev.rafflewinnerpicker.com',
        'pr123.dev.rafflewinnerpicker.com',
        'staging.dev.rafflewinnerpicker.com',
      ];

      nonProdHostnames.forEach(hostname => {
        const isNonProd = hostname.endsWith(mockImportMetaEnv.nonprod_hosted_zone);
        const isProduction = !isNonProd && hostname.endsWith(mockImportMetaEnv.prod_hosted_zone);

        expect(isNonProd).toBe(true);
        expect(isProduction).toBe(false);
      });
    });

    test('should correctly identify unknown hostnames', () => {
      const unknownHostnames = [
        'localhost',
        '127.0.0.1',
        'example.com',
        'test.example.org',
      ];

      unknownHostnames.forEach(hostname => {
        const isNonProd = hostname.endsWith(mockImportMetaEnv.nonprod_hosted_zone);
        const isProduction = !isNonProd && hostname.endsWith(mockImportMetaEnv.prod_hosted_zone);

        expect(isNonProd).toBe(false);
        expect(isProduction).toBe(false);
      });
    });
  });

  describe('getAuth0ClientId logic simulation', () => {
    const getAuth0ClientIdLogic = (hostname: string) => {
      const isNonProd = hostname.endsWith(mockImportMetaEnv.nonprod_hosted_zone);
      const isProduction = !isNonProd && hostname.endsWith(mockImportMetaEnv.prod_hosted_zone);

      let clientId = '';
      if (isProduction) {
        clientId = mockImportMetaEnv.VITE_AUTH0_CLIENT_ID_PROD || '';
      } else if (isNonProd) {
        clientId = mockImportMetaEnv.VITE_AUTH0_CLIENT_ID_DEV || '';
      } else {
        clientId = mockImportMetaEnv.VITE_SPA_AUTH0_CLIENT_ID || mockImportMetaEnv.VITE_AUTH0_CLIENT_ID || '';
      }

      return { clientId, isProduction, isNonProd };
    };

    test('should select prod client ID for production hostnames', () => {
      const result = getAuth0ClientIdLogic('rafflewinnerpicker.com');
      expect(result.isProduction).toBe(true);
      expect(result.isNonProd).toBe(false);
      expect(result.clientId).toBe('prod_client_id');
    });

    test('should select dev client ID for non-production hostnames', () => {
      const result = getAuth0ClientIdLogic('dev.rafflewinnerpicker.com');
      expect(result.isNonProd).toBe(true);
      expect(result.isProduction).toBe(false);
      expect(result.clientId).toBe('dev_client_id');
    });

    test('should select fallback client ID for unknown hostnames', () => {
      const result = getAuth0ClientIdLogic('localhost');
      expect(result.isNonProd).toBe(false);
      expect(result.isProduction).toBe(false);
      expect(result.clientId).toBe('spa_client_id');
    });

    test('should handle PR environment hostnames', () => {
      const result = getAuth0ClientIdLogic('pr123.dev.rafflewinnerpicker.com');
      expect(result.isNonProd).toBe(true);
      expect(result.isProduction).toBe(false);
      expect(result.clientId).toBe('dev_client_id');
    });

    test('should handle missing client IDs gracefully', () => {
      const customEnv = {
        ...mockImportMetaEnv,
        VITE_AUTH0_CLIENT_ID_PROD: '',
        VITE_AUTH0_CLIENT_ID_DEV: '',
      };

      const getClientIdWithCustomEnv = (hostname: string) => {
        const isNonProd = hostname.endsWith(customEnv.nonprod_hosted_zone);
        const isProduction = !isNonProd && hostname.endsWith(customEnv.prod_hosted_zone);

        let clientId = '';
        if (isProduction) {
          clientId = customEnv.VITE_AUTH0_CLIENT_ID_PROD || '';
        } else if (isNonProd) {
          clientId = customEnv.VITE_AUTH0_CLIENT_ID_DEV || '';
        } else {
          clientId = customEnv.VITE_SPA_AUTH0_CLIENT_ID || customEnv.VITE_AUTH0_CLIENT_ID || '';
        }

        return clientId;
      };

      // Should fall back to SPA client ID for unknown hostnames
      expect(getClientIdWithCustomEnv('localhost')).toBe('spa_client_id');
      // Should return empty string for production when prod client ID is missing
      expect(getClientIdWithCustomEnv('rafflewinnerpicker.com')).toBe('');
      // Should return empty string for dev when dev client ID is missing
      expect(getClientIdWithCustomEnv('dev.rafflewinnerpicker.com')).toBe('');
    });
  });

  describe('getHostedZone logic simulation', () => {
    const getHostedZoneLogic = (hostname: string) => {
      const isNonProd = hostname.endsWith(mockImportMetaEnv.nonprod_hosted_zone);
      return isNonProd
        ? mockImportMetaEnv.nonprod_hosted_zone
        : mockImportMetaEnv.prod_hosted_zone;
    };

    test('should return non-prod hosted zone for non-prod hostnames', () => {
      const hostedZone = getHostedZoneLogic('dev.rafflewinnerpicker.com');
      expect(hostedZone).toBe('dev.rafflewinnerpicker.com');
    });

    test('should return prod hosted zone for production hostnames', () => {
      const hostedZone = getHostedZoneLogic('rafflewinnerpicker.com');
      expect(hostedZone).toBe('rafflewinnerpicker.com');
    });

    test('should return prod hosted zone for unknown hostnames', () => {
      const hostedZone = getHostedZoneLogic('unknown.example.com');
      expect(hostedZone).toBe('rafflewinnerpicker.com');
    });

    test('should handle PR environment hostnames', () => {
      const hostedZone = getHostedZoneLogic('pr456.dev.rafflewinnerpicker.com');
      expect(hostedZone).toBe('dev.rafflewinnerpicker.com');
    });

    test('should handle localhost', () => {
      const hostedZone = getHostedZoneLogic('localhost');
      expect(hostedZone).toBe('rafflewinnerpicker.com');
    });
  });

  describe('Environment variable fallback logic', () => {
    test('should handle complete environment variable absence', () => {
      const emptyEnv = {
        VITE_AUTH0_CLIENT_ID: '',
        VITE_SPA_AUTH0_CLIENT_ID: '',
        VITE_AUTH0_CLIENT_ID_DEV: '',
        VITE_AUTH0_CLIENT_ID_PROD: '',
        nonprod_hosted_zone: 'dev.rafflewinnerpicker.com',
        prod_hosted_zone: 'rafflewinnerpicker.com',
      };

      const getClientIdWithEmptyEnv = (hostname: string) => {
        const isNonProd = hostname.endsWith(emptyEnv.nonprod_hosted_zone);
        const isProduction = !isNonProd && hostname.endsWith(emptyEnv.prod_hosted_zone);

        let clientId = '';
        if (isProduction) {
          clientId = emptyEnv.VITE_AUTH0_CLIENT_ID_PROD || '';
        } else if (isNonProd) {
          clientId = emptyEnv.VITE_AUTH0_CLIENT_ID_DEV || '';
        } else {
          clientId = emptyEnv.VITE_SPA_AUTH0_CLIENT_ID || emptyEnv.VITE_AUTH0_CLIENT_ID || '';
        }

        return clientId;
      };

      expect(getClientIdWithEmptyEnv('localhost')).toBe('');
      expect(getClientIdWithEmptyEnv('rafflewinnerpicker.com')).toBe('');
      expect(getClientIdWithEmptyEnv('dev.rafflewinnerpicker.com')).toBe('');
    });

    test('should handle partial environment variable presence', () => {
      const partialEnv = {
        VITE_AUTH0_CLIENT_ID: 'generic_client_id',
        VITE_SPA_AUTH0_CLIENT_ID: '',
        VITE_AUTH0_CLIENT_ID_DEV: 'dev_client_id',
        VITE_AUTH0_CLIENT_ID_PROD: '',
        nonprod_hosted_zone: 'dev.rafflewinnerpicker.com',
        prod_hosted_zone: 'rafflewinnerpicker.com',
      };

      const getClientIdWithPartialEnv = (hostname: string) => {
        const isNonProd = hostname.endsWith(partialEnv.nonprod_hosted_zone);
        const isProduction = !isNonProd && hostname.endsWith(partialEnv.prod_hosted_zone);

        let clientId = '';
        if (isProduction) {
          clientId = partialEnv.VITE_AUTH0_CLIENT_ID_PROD || '';
        } else if (isNonProd) {
          clientId = partialEnv.VITE_AUTH0_CLIENT_ID_DEV || '';
        } else {
          clientId = partialEnv.VITE_SPA_AUTH0_CLIENT_ID || partialEnv.VITE_AUTH0_CLIENT_ID || '';
        }

        return clientId;
      };

      // Should fall back to generic client ID for unknown hostnames
      expect(getClientIdWithPartialEnv('localhost')).toBe('generic_client_id');
      // Should return empty string for production when prod client ID is missing
      expect(getClientIdWithPartialEnv('rafflewinnerpicker.com')).toBe('');
      // Should use dev client ID when available
      expect(getClientIdWithPartialEnv('dev.rafflewinnerpicker.com')).toBe('dev_client_id');
    });
  });

  describe('Edge cases', () => {
    test('should handle empty hostname', () => {
      const hostname = '';
      const isNonProd = hostname.endsWith(mockImportMetaEnv.nonprod_hosted_zone);
      const isProduction = !isNonProd && hostname.endsWith(mockImportMetaEnv.prod_hosted_zone);

      expect(isNonProd).toBe(false);
      expect(isProduction).toBe(false);
    });

    test('should handle single character hostname', () => {
      const hostname = 'a';
      const isNonProd = hostname.endsWith(mockImportMetaEnv.nonprod_hosted_zone);
      const isProduction = !isNonProd && hostname.endsWith(mockImportMetaEnv.prod_hosted_zone);

      expect(isNonProd).toBe(false);
      expect(isProduction).toBe(false);
    });

    test('should handle very long hostname', () => {
      const hostname = 'very-long-subdomain-name.pr123.dev.rafflewinnerpicker.com';
      const isNonProd = hostname.endsWith(mockImportMetaEnv.nonprod_hosted_zone);
      const isProduction = !isNonProd && hostname.endsWith(mockImportMetaEnv.prod_hosted_zone);

      expect(isNonProd).toBe(true);
      expect(isProduction).toBe(false);
    });

    test('should handle case sensitivity', () => {
      const hostname = 'DEV.RAFFLEWINNERPICKER.COM';
      const isNonProd = hostname.endsWith(mockImportMetaEnv.nonprod_hosted_zone);
      const isProduction = !isNonProd && hostname.endsWith(mockImportMetaEnv.prod_hosted_zone);

      // Since endsWith is case-sensitive, this should not match
      expect(isNonProd).toBe(false);
      expect(isProduction).toBe(false);
    });

    test('should handle partial hostname matches that should NOT match', () => {
      // This should NOT match dev.rafflewinnerpicker.com because it doesn't end with that exact string
      const hostname = 'dev.rafflewinnerpicker.com.evil.com';
      const isNonProd = hostname.endsWith(mockImportMetaEnv.nonprod_hosted_zone);
      const isProduction = !isNonProd && hostname.endsWith(mockImportMetaEnv.prod_hosted_zone);

      expect(isNonProd).toBe(false);
      expect(isProduction).toBe(false);
    });
  });
});