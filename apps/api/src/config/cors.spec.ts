import {
  buildCorsOriginValidator,
  normalizeOrigin,
  parseAllowedOrigins,
} from './cors';
import { AppLogger } from '../observability/app-logger.service';

describe('cors config helpers', () => {
  it('falls back to localhost origins when env is undefined', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });

  it('parses comma, newline and semicolon separated origins', () => {
    expect(
      parseAllowedOrigins(
        ' https://directcashweb-production.up.railway.app,\nhttps://admin.example.com;https://admin.example.com ',
      ),
    ).toEqual([
      'https://directcashweb-production.up.railway.app',
      'https://admin.example.com',
    ]);
  });

  it('parses json arrays and strips trailing slashes', () => {
    expect(
      parseAllowedOrigins(
        '["https://directcashweb-production.up.railway.app/"]',
      ),
    ).toEqual(['https://directcashweb-production.up.railway.app']);
  });

  it('normalizes quoted origins', () => {
    expect(
      normalizeOrigin('"https://directcashweb-production.up.railway.app/"'),
    ).toBe('https://directcashweb-production.up.railway.app');
  });

  it('allows configured origins and logs rejected ones', () => {
    const logger = {
      logWithMetadata: jest.fn(),
    } as unknown as AppLogger;
    const validateOrigin = buildCorsOriginValidator(
      ['https://directcashweb-production.up.railway.app'],
      logger,
    );
    const callback = jest.fn();

    validateOrigin(
      'https://directcashweb-production.up.railway.app/',
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, true);

    callback.mockClear();
    validateOrigin('https://unexpected.example.com', callback);

    expect(callback).toHaveBeenCalledWith(null, false);
    expect(logger.logWithMetadata).toHaveBeenCalledWith(
      'warn',
      'Rejected request from origin outside CORS allowlist',
      expect.objectContaining({
        requestOrigin: 'https://unexpected.example.com',
      }),
      'Cors',
    );
  });
});
