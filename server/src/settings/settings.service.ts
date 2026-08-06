import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { Settings, SettingsDocument } from './settings.schema'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object') return false
  if (Array.isArray(v)) return false
  return Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch as T
  const out: Record<string, unknown> = { ...(base as any) }
  for (const [k, v] of Object.entries(patch)) {
    const cur = (out as any)[k]
    if (isPlainObject(cur) && isPlainObject(v)) {
      ;(out as any)[k] = deepMerge(cur, v)
    } else {
      ;(out as any)[k] = v
    }
  }
  return out as T
}

@Injectable()
export class SettingsService {
  constructor(@InjectModel(Settings.name) private readonly settingsModel: Model<SettingsDocument>) {}

  async getOrCreate() {
    return this.settingsModel
      .findOneAndUpdate(
        { key: 'default' },
        {
          $setOnInsert: {
            key: 'default',
            company: {},
            branding: {},
            home: {},
            booking: { defaultStatus: 'pending', holdMinutes: 0 },
            payment: { enableDeposit: true, depositPercent: 30 },
            notifications: { enableInApp: true, enableEmail: false, enableSms: false, enableZalo: false, templates: {} },
            security: { loginMaxAttempts: 10, loginLockMinutes: 0, auditRetentionDays: 0 },
            integrations: { emailProvider: 'none', smsProvider: 'none', zaloProvider: 'none' },
            masterData: { destinations: [], departureFrom: [], transportTypes: [], tags: [] },
          },
        },
        { upsert: true, new: true },
      )
      .exec()
  }

  async updateSection(section: keyof Settings, patch: Record<string, unknown>) {
    const current = await this.getOrCreate()
    const nextSection = deepMerge((current as any)[section], patch)
    ;(current as any)[section] = nextSection
    await current.save()
    return current
  }
}
