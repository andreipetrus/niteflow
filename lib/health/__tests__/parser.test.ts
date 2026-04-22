import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { parseHealthXml, parseAppleDate } from '../parser'

const fixturePath = path.join(__dirname, '../__fixtures__/sample-export.xml')

describe('parseAppleDate', () => {
  it('parses "2024-01-15 22:30:00 -0500" to the correct Unix seconds', () => {
    // 2024-01-15 22:30:00 EST = 2024-01-16 03:30:00 UTC
    const ts = parseAppleDate('2024-01-15 22:30:00 -0500')
    expect(new Date(ts * 1000).toISOString()).toBe('2024-01-16T03:30:00.000Z')
  })

  it('handles positive offsets (+0100 Berlin)', () => {
    const ts = parseAppleDate('2024-01-15 22:30:00 +0100')
    // 2024-01-15 22:30:00 +0100 = 2024-01-15 21:30:00 UTC
    expect(new Date(ts * 1000).toISOString()).toBe('2024-01-15T21:30:00.000Z')
  })

  it('handles UTC (+0000)', () => {
    const ts = parseAppleDate('2024-01-15 12:00:00 +0000')
    expect(new Date(ts * 1000).toISOString()).toBe('2024-01-15T12:00:00.000Z')
  })

  it('returns NaN for malformed input', () => {
    expect(parseAppleDate('garbage')).toBeNaN()
  })
})

describe('parseHealthXml', () => {
  it('extracts only the 5 relevant record types, ignoring others', async () => {
    const stream = fs.createReadStream(fixturePath)
    const records: Array<{ type: string }> = []

    for await (const r of parseHealthXml(stream)) {
      records.push(r)
    }

    const types = [...new Set(records.map((r) => r.type))].sort()
    expect(types).toEqual([
      'HKCategoryTypeIdentifierSleepAnalysis',
      'HKQuantityTypeIdentifierHeartRate',
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
      'HKQuantityTypeIdentifierOxygenSaturation',
      'HKQuantityTypeIdentifierRespiratoryRate',
    ])
    // StepCount should NOT appear
    expect(records.find((r) => r.type === 'HKQuantityTypeIdentifierStepCount')).toBeUndefined()
  })

  it('parses sleep stage records with correct value enums', async () => {
    const stream = fs.createReadStream(fixturePath)
    const sleepRecords = []

    for await (const r of parseHealthXml(stream)) {
      if (r.type === 'HKCategoryTypeIdentifierSleepAnalysis') sleepRecords.push(r)
    }

    expect(sleepRecords.length).toBe(7)
    const values = sleepRecords.map((r) => r.value)
    expect(values).toContain('HKCategoryValueSleepAnalysisInBed')
    expect(values).toContain('HKCategoryValueSleepAnalysisAsleepCore')
    expect(values).toContain('HKCategoryValueSleepAnalysisAsleepDeep')
    expect(values).toContain('HKCategoryValueSleepAnalysisAsleepREM')
    expect(values).toContain('HKCategoryValueSleepAnalysisAwake')
  })

  it('parses quantity records with numeric values', async () => {
    const stream = fs.createReadStream(fixturePath)
    const hrvRecords = []

    for await (const r of parseHealthXml(stream)) {
      if (r.type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN') hrvRecords.push(r)
    }

    expect(hrvRecords.length).toBe(2)
    expect(hrvRecords[0].value).toBe('45.2')
    expect(hrvRecords[0].unit).toBe('ms')
  })

  it('correctly parses start and end timestamps', async () => {
    const stream = fs.createReadStream(fixturePath)
    const records = []
    for await (const r of parseHealthXml(stream)) records.push(r)

    const firstInBed = records.find((r) => r.value === 'HKCategoryValueSleepAnalysisInBed')!
    expect(firstInBed.startTs).toBeLessThan(firstInBed.endTs)
    expect(firstInBed.endTs - firstInBed.startTs).toBe(90 * 60) // 90 minutes
  })

  it('works with a raw string stream (not just file stream)', async () => {
    const xml = `<?xml version="1.0"?>
<HealthData>
<Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" startDate="2024-01-01 12:00:00 +0000" endDate="2024-01-01 12:00:00 +0000" value="60"/>
</HealthData>`
    const records = []
    for await (const r of parseHealthXml(Readable.from([xml]))) records.push(r)

    expect(records).toHaveLength(1)
    expect(records[0].type).toBe('HKQuantityTypeIdentifierHeartRate')
    expect(records[0].value).toBe('60')
  })
})
