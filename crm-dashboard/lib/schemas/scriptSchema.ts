import { z } from 'zod'

export const scriptSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim(),
  body: z
    .string()
    .min(1, 'Script body is required')
    .trim(),
})

export type ScriptFormValues = z.infer<typeof scriptSchema>
