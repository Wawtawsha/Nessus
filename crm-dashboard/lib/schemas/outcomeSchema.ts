import { z } from 'zod'

export const outcomeSchema = z.object({
  lead_id: z.string().uuid('Please select a lead'),
  notes: z.string().optional(),
})

export type OutcomeFormValues = z.infer<typeof outcomeSchema>
