import { z } from 'zod';

export const CreateControllerSchema = z.object({
  name: z.string().min(1),

  ipAddress: z.ipv4(),

  port: z.number().int().positive(),

  unitId: z.number().int().positive(),

  model: z.string().optional(),
});
