#!/usr/bin/env node
"use strict"

const assert = require("assert")
const Model = require("../Model.js")

// Virginia Beach in November is UTC-5. 06:47 local is 11:47 UTC.
const offset = -18000
const report = {
  utc_offset_seconds: offset,
  daily: {
    sunrise: ["2026-11-10T06:47", "2026-11-11T06:48", null],
    sunset: ["2026-11-10T17:02", "2026-11-11T17:01", "2026-11-12T17:00"]
  }
}

const rise = Model.parseLocationInstant("2026-11-10T06:47", offset)
const set = Model.parseLocationInstant("2026-11-10T17:02", offset)
assert.strictEqual(new Date(rise).toISOString(), "2026-11-10T11:47:00.000Z")
assert.strictEqual(new Date(set).toISOString(), "2026-11-10T22:02:00.000Z")

assert.strictEqual(Model.sunBarLabel(report, rise - 1), "\u2191 06:47")
assert.strictEqual(Model.sunBarLabel(report, rise), "\u2193 17:02")
assert.strictEqual(Model.sunBarLabel(report, set - 1), "\u2193 17:02")
assert.strictEqual(Model.sunBarLabel(report, set), "\u2191 06:48")

// A day with no sunrise still yields its sunset.
const polar = {
  utc_offset_seconds: 0,
  daily: {
    sunrise: [null, "2026-06-21T00:10"],
    sunset: ["2026-06-20T23:50", "2026-06-21T23:40"]
  }
}
const polarSet = Model.parseLocationInstant("2026-06-20T23:50", 0)
assert.strictEqual(Model.sunBarLabel(polar, polarSet - 1000), "\u2193 23:50")
assert.strictEqual(Model.sunBarLabel(polar, polarSet), "\u2191 00:10")

assert.strictEqual(Model.sunBarLabel(null, rise), "")
assert.strictEqual(Model.sunBarLabel({ daily: {} }, rise), "")
assert.strictEqual(Model.sunBarLabel(report, Model.parseLocationInstant("2026-11-12T17:00", offset)), "")

assert.strictEqual(Model.formatSpan(0), "0m")
assert.strictEqual(Model.formatSpan(42 * 60000), "42m")
assert.strictEqual(Model.formatSpan(2 * 3600000), "2h")
assert.strictEqual(Model.formatSpan(7 * 3600000 + 56 * 60000), "7h 56m")
assert.strictEqual(Model.relativeWhen(0, true), "now")
assert.strictEqual(Model.relativeWhen(90 * 60000, true), "in 1h 30m")
assert.strictEqual(Model.relativeWhen(-90 * 60000, false), "1h 30m ago")

// A short November day peaks left of the chart's middle.
const day = {
  utc_offset_seconds: offset,
  daily: {
    sunrise: ["2026-11-09T06:46", "2026-11-10T06:47", "2026-11-11T06:48"],
    sunset: ["2026-11-09T17:03", "2026-11-10T17:02", "2026-11-11T17:01"]
  }
}
const afternoon = Model.parseLocationInstant("2026-11-10T13:00", offset)
const afternoonCurve = Model.daylightCurve(day, afternoon)
assert.ok(afternoonCurve.setFraction < 0.5)
assert.strictEqual(afternoonCurve.prev.kind, "sunrise")
assert.strictEqual(afternoonCurve.prev.clock, "06:47")
assert.ok(afternoonCurve.prev.when.endsWith("ago"))
assert.strictEqual(afternoonCurve.next.kind, "sunset")
assert.strictEqual(afternoonCurve.next.clock, "17:02")
assert.ok(afternoonCurve.next.when.startsWith("in "))
assert.ok(afternoonCurve.nowFraction < afternoonCurve.setFraction)
assert.ok(Model.daylightHeight(afternoonCurve.setFraction / 2, afternoonCurve.setFraction) > 0.99)
assert.ok(Math.abs(Model.daylightHeight(afternoonCurve.setFraction, afternoonCurve.setFraction)) < 1e-12)
assert.strictEqual(Model.daylightHeight(0.5, afternoonCurve.setFraction), 0)

const evening = Model.parseLocationInstant("2026-11-10T22:00", offset)
const eveningCurve = Model.daylightCurve(day, evening)
assert.strictEqual(eveningCurve.prev.kind, "sunset")
assert.strictEqual(eveningCurve.prev.clock, "17:02")
assert.ok(eveningCurve.prev.when.endsWith("ago"))
assert.strictEqual(eveningCurve.next.kind, "sunrise")
assert.strictEqual(eveningCurve.next.clock, "06:48")
assert.ok(eveningCurve.next.when.startsWith("in "))
assert.ok(eveningCurve.nowFraction > eveningCurve.setFraction)
assert.strictEqual(Model.daylightHeight(eveningCurve.nowFraction, eveningCurve.setFraction), 0)

const beforeDawn = Model.parseLocationInstant("2026-11-10T05:00", offset)
const dawnCurve = Model.daylightCurve(day, beforeDawn)
assert.strictEqual(dawnCurve.prev.kind, "sunset")
assert.strictEqual(dawnCurve.prev.clock, "17:03")
assert.strictEqual(dawnCurve.next.kind, "sunrise")
assert.strictEqual(dawnCurve.next.clock, "06:47")

assert.strictEqual(Model.daylightCurve(null, afternoon), null)
assert.strictEqual(Model.daylightCurve({ daily: { sunrise: [null], sunset: [null] } }, afternoon), null)

console.log("sun tests ok")
