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

// A short November day. The window is today's sunrise through tomorrow's
// sunrise once the sun is up, and yesterday's sunset through today's sunset
// before dawn. The wave crosses zero at each of those events.
const day = {
  utc_offset_seconds: offset,
  daily: {
    sunrise: ["2026-11-09T06:46", "2026-11-10T06:47", "2026-11-11T06:48"],
    sunset: ["2026-11-09T17:03", "2026-11-10T17:02", "2026-11-11T17:01"]
  }
}

function marker(curve, kind, role) {
  return curve.markers.find(function(item) { return item.kind === kind && item.role === role })
}

const afternoon = Model.parseLocationInstant("2026-11-10T13:00", offset)
const afternoonCurve = Model.daylightCurve(day, afternoon)
assert.strictEqual(afternoonCurve.phase, "Midday")
assert.strictEqual(afternoonCurve.markers.length, 3)
const afternoonRise = marker(afternoonCurve, "sunrise", "prev")
const afternoonSet = marker(afternoonCurve, "sunset", "next")
assert.strictEqual(afternoonRise.clock, "06:47")
assert.ok(afternoonRise.when.endsWith("ago"))
assert.strictEqual(afternoonRise.relation, "")
assert.strictEqual(afternoonSet.clock, "17:02")
assert.ok(afternoonSet.when.startsWith("in "))
const afternoonTomorrow = marker(afternoonCurve, "sunrise", "context")
assert.strictEqual(afternoonTomorrow.clock, "06:48")
assert.strictEqual(afternoonTomorrow.relation, "tomorrow")
// Winter sunset sits left of the chart's middle.
assert.ok(afternoonSet.fraction < 0.5)
assert.ok(afternoonCurve.nowFraction > afternoonRise.fraction)
assert.ok(afternoonCurve.nowFraction < afternoonSet.fraction)
const afternoonPeak = (afternoonRise.fraction + afternoonSet.fraction) / 2
assert.ok(Model.solarHeight(afternoonCurve, afternoonPeak) > 0.99)
assert.strictEqual(Model.solarHeight(afternoonCurve, afternoonSet.fraction), 0)
assert.ok(Model.solarHeight(afternoonCurve, afternoonCurve.nowFraction) > 0)
// Night, past this sunset, is below the horizon.
const afternoonTrough = (afternoonSet.fraction + afternoonTomorrow.fraction) / 2
assert.ok(Model.solarHeight(afternoonCurve, afternoonTrough) < -0.99)

const evening = Model.parseLocationInstant("2026-11-10T22:00", offset)
const eveningCurve = Model.daylightCurve(day, evening)
assert.strictEqual(eveningCurve.phase, "Evening")
const eveningSet = marker(eveningCurve, "sunset", "prev")
const eveningRise = marker(eveningCurve, "sunrise", "next")
assert.strictEqual(eveningSet.clock, "17:02")
assert.ok(eveningSet.when.endsWith("ago"))
assert.strictEqual(eveningRise.clock, "06:48")
assert.strictEqual(eveningRise.relation, "tomorrow")
assert.ok(eveningRise.when.startsWith("in "))
assert.ok(eveningCurve.nowFraction > eveningSet.fraction)
assert.ok(eveningCurve.nowFraction < eveningRise.fraction)
assert.ok(Model.solarHeight(eveningCurve, eveningCurve.nowFraction) < 0)
assert.strictEqual(marker(eveningCurve, "sunrise", "context").relation, "")
assert.strictEqual(marker(eveningCurve, "sunrise", "context").when, "this morning")

const beforeDawn = Model.parseLocationInstant("2026-11-10T05:00", offset)
const dawnCurve = Model.daylightCurve(day, beforeDawn)
assert.strictEqual(dawnCurve.phase, "Almost sunrise")
assert.strictEqual(marker(dawnCurve, "sunset", "prev").clock, "17:03")
assert.strictEqual(marker(dawnCurve, "sunset", "prev").relation, "yesterday")
assert.strictEqual(marker(dawnCurve, "sunrise", "next").clock, "06:47")
assert.strictEqual(marker(dawnCurve, "sunset", "context").clock, "17:02")
assert.ok(Model.solarHeight(dawnCurve, dawnCurve.nowFraction) < 0)
assert.ok(dawnCurve.nowFraction < marker(dawnCurve, "sunrise", "next").fraction)

// A long June day peaks right of center. The horizon crossings still land
// on sunrise and sunset, and the trough is the middle of the short night.
const summer = {
  utc_offset_seconds: offset,
  daily: {
    sunrise: ["2026-06-20T05:40", "2026-06-21T05:40", "2026-06-22T05:41"],
    sunset: ["2026-06-20T20:25", "2026-06-21T20:25", "2026-06-22T20:25"]
  }
}
const summerNow = Model.parseLocationInstant("2026-06-21T15:00", offset)
const summerCurve = Model.daylightCurve(summer, summerNow)
const summerSet = marker(summerCurve, "sunset", "next")
const summerRise = marker(summerCurve, "sunrise", "prev")
assert.ok(summerSet.fraction > 0.5)
assert.ok(Model.solarHeight(summerCurve, (summerRise.fraction + summerSet.fraction) / 2) > 0.99)
assert.strictEqual(summerCurve.phase, "Afternoon")

assert.strictEqual(Model.solarHeight(null, 0.5), 0)
assert.strictEqual(Model.daylightCurve(null, afternoon), null)
assert.strictEqual(Model.daylightCurve({ daily: { sunrise: [null], sunset: [null] } }, afternoon), null)
assert.strictEqual(Model.daylightCurve({
  utc_offset_seconds: offset,
  daily: { sunrise: ["2026-11-10T06:47"], sunset: ["2026-11-10T17:02"] }
}, afternoon), null)

console.log("sun tests ok")
