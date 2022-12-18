import { config } from 'dotenv';
import { z } from 'zod';

config({ path: '.env.prod' });

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(5),
  OPENAI_EMAIL: z.string().min(5),
  OPENAI_PASSWORD: z.string().min(5),
  ALLOWED_IDS: z.string().min(0),
  AZURE_SPEECH_KEY: z.string().min(0),
  AZURE_SPEECH_REGION: z.string().min(0)
});

export const env = envSchema.parse(process.env);

export const isDev = process.env.NODE_ENV === 'development';

export const isProd = !isDev;

export default env;
