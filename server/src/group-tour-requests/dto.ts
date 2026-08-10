import { z } from 'zod'

export const CreateGroupTourRequestZod = z.object({
  contactName: z.string().min(2).max(120),
  contactPhone: z.string().min(8).max(20),
  contactEmail: z.string().email().nullable().optional().default(null),
  contactRole: z.string().max(80).nullable().optional().default(null),
  companyOrGroupName: z.string().min(2).max(200),
  companyTaxCode: z.string().max(50).nullable().optional().default(null),
  adultCount: z.coerce.number().int().min(1).max(2000),
  childCount: z.coerce.number().int().min(0).max(2000).default(0),
  infantCount: z.coerce.number().int().min(0).max(2000).default(0),
  departureCity: z.string().max(120).nullable().optional().default(null),
  destination: z.string().min(2).max(200),
  approximateDurationText: z.string().max(120).nullable().optional().default(null),
  preferredStartDate: z.string().nullable().optional().default(null),
  preferredEndDate: z.string().nullable().optional().default(null),
  hotelClassRequested: z.string().max(80).nullable().optional().default(null),
  servicesPreference: z.object({
    needVisa: z.boolean().default(false),
    needFlight: z.boolean().default(false),
    needBus: z.boolean().default(false),
    needHotel: z.boolean().default(true),
    needMeals: z.boolean().default(true),
    needGuide: z.boolean().default(true),
  }).optional(),
  transportRequestedNotes: z.string().max(300).nullable().optional().default(null),
  budgetPerPersonVnd: z.coerce.number().min(0).nullable().optional().default(null),
  totalBudgetVnd: z.coerce.number().min(0).nullable().optional().default(null),
  specialRequirements: z.string().max(3000).nullable().optional().default(null),
  sourceChannel: z.string().max(120).nullable().optional().default('website_form'),
})

export const AdminPatchGroupTourRequestZod = z.object({
  status: z.enum(['new', 'contacted', 'quoting', 'negotiating', 'won', 'converted_booking', 'lost', 'archived']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedStaffId: z.string().max(60).nullable().optional(),
  internalStaffNote: z.string().max(3000).nullable().optional(),
  lastQuoteSummary: z.string().max(1000).nullable().optional(),
  followUpAt: z.string().nullable().optional(),
  lostReason: z.string().max(500).nullable().optional(),
  convertedBookingId: z.string().max(60).nullable().optional(),
  quoteCount: z.coerce.number().int().min(0).max(500).optional(),
  lastContactedAt: z.string().nullable().optional(),
  wonAt: z.string().nullable().optional(),
})

export type CreateGroupTourRequestDTO = z.infer<typeof CreateGroupTourRequestZod>
export type AdminPatchGroupTourRequestDTO = z.infer<typeof AdminPatchGroupTourRequestZod>
