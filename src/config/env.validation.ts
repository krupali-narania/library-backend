import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }),
  DB_HOST: Joi.string(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string(),
  DB_PASS: Joi.string(),
  DB_NAME: Joi.string(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  FRONTEND_URL: Joi.string().uri().required(),
})
  .or('DATABASE_URL', 'DB_HOST')
  .when(Joi.object({ DB_HOST: Joi.exist() }).unknown(), {
    then: Joi.object({
      DB_USER: Joi.required(),
      DB_PASS: Joi.required(),
      DB_NAME: Joi.required(),
    }),
  });
