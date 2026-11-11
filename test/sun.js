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

console.log("sun tests ok")
