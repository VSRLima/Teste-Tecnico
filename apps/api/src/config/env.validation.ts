import * as Joi from 'joi';

const jwtDurationPattern = /^\d+[smhdwMy]$/;

export type AppEnvironment = {
  ALLOWED_ORIGINS?: string;
  DATABASE_URL: string;
  FAKE_PASSWORD_HASH: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_SECRET: string;
  NODE_ENV: string;
  PORT: number;
  REDIS_DB: number;
  REDIS_HOST: string;
  REDIS_PASSWORD?: string;
  REDIS_PORT: number;
  REDIS_USERNAME?: string;
  SWAGGER_ENABLED: string;
  SWAGGER_PASSWORD?: string;
  SWAGGER_USER?: string;
};

const envSchema = Joi.object<AppEnvironment>({
  ALLOWED_ORIGINS: Joi.string().allow('').optional(),
  NODE_ENV: Joi.string().default('development'),
  PORT: Joi.number().port().default(3333),
  DATABASE_URL: Joi.string().required(),
  FAKE_PASSWORD_HASH: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().pattern(jwtDurationPattern).default('1d'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(jwtDurationPattern)
    .default('7d'),
  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_DB: Joi.number().integer().min(0).default(0),
  REDIS_USERNAME: Joi.string().allow('').optional(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  SWAGGER_ENABLED: Joi.string().valid('true', 'false').default('false'),
  SWAGGER_USER: Joi.string().allow('').optional(),
  SWAGGER_PASSWORD: Joi.string().allow('').optional(),
})
  .custom((value: AppEnvironment, helpers) => {
    if (
      value.SWAGGER_ENABLED === 'true' &&
      (!value.SWAGGER_USER || !value.SWAGGER_PASSWORD)
    ) {
      return helpers.error('any.custom');
    }

    return value;
  })
  .messages({
    'any.custom':
      'SWAGGER_USER and SWAGGER_PASSWORD are required when SWAGGER_ENABLED is true',
    'string.pattern.base':
      'JWT_EXPIRES_IN and JWT_REFRESH_EXPIRES_IN must use a duration like 1d, 12h or 30m',
  });

export function validateEnvironment(
  config: Record<string, unknown>,
): AppEnvironment {
  const validationResult = envSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (validationResult.error) {
    throw new Error(
      `Environment validation error: ${validationResult.error.message}`,
    );
  }

  return validationResult.value;
}
