// weather.json holds {"name": ..., "latitude": ..., "longitude": ...} (see
// omarchy-weather-location, which owns the format). Missing, blank, or
// unparseable means the location is auto-detected (see isAutoLocation).
function parseLocationFile(raw) {
  var unset = { name: "", latitude: null, longitude: null }
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || typeof data !== "object") return unset

    var latitude = parseFloat(data.latitude)
    var longitude = parseFloat(data.longitude)
    var hasCoordinates = !isNaN(latitude) && !isNaN(longitude)
    return {
      name: typeof data.name === "string" ? data.name.replace(/^\s+|\s+$/g, "") : "",
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null
    }
  } catch (e) {
    return unset
  }
}

// True when weather.json names no place: the panel then reports for wherever
// geo.omarchy.org places this network.
function isAutoLocation(state) {
  var s = state || {}
  return String(s.name || "") === "" && (s.latitude === null || s.latitude === undefined)
}

// The location to report for: the stored one, or with none stored, the one
// geo.omarchy.org detected. geo.omarchy.org answers in weather.json's shape, so
// both come from parseLocationFile.
function effectiveLocation(configured, detected) {
  return isAutoLocation(configured) && detected ? detected : configured
}

// wttr.in path segment for a configured location: exact coordinates when
// both are present, the URL-encoded name as a fallback (hand-edited
// weather.loc files may only carry a name), empty for IP auto-detect.
function wttrLocationQuery(location, latitude, longitude) {
  var lat = parseFloat(String(latitude))
  var lon = parseFloat(String(longitude))
  if (!isNaN(lat) && !isNaN(lon)) return lat + "," + lon

  var name = String(location || "").replace(/^\s+|\s+$/g, "")
  return name === "" ? "" : encodeURIComponent(name)
}

// Open-Meteo geocoding response → suggestion rows for the location picker.
function parseGeocodingResults(raw) {
  try {
    var data = JSON.parse(String(raw || "{}"))
    var results = data.results
    if (!results || !results.length) return []

    var out = []
    for (var i = 0; i < results.length; i++) {
      var r = results[i]
      if (!r || !r.name || r.latitude === undefined || r.longitude === undefined) continue
      var region = [r.admin1, r.country].filter(function(part) { return !!part }).join(", ")
      out.push({
        name: String(r.name),
        description: region,
        latitude: r.latitude,
        longitude: r.longitude
      })
    }
    return out
  } catch (e) {
    return []
  }
}

function locationCommit(text, suggestions, selectedIndex) {
  var name = String(text || "").replace(/^\s+|\s+$/g, "")
  if (name === "") return { name: "", latitude: null, longitude: null }

  var choices = suggestions || []
  var index = Math.max(0, Math.min(parseInt(selectedIndex, 10) || 0, choices.length - 1))
  var suggestion = choices[index]
  if (suggestion) return suggestion

  return { name: name, latitude: null, longitude: null }
}

function isFutureForecastDate(dateString, todayString) {
  if (!dateString) return false
  return String(dateString).slice(0, 10) > String(todayString || "")
}

function roundedTemp(value) {
  if (value === undefined || value === null || value === "") return ""
  var n = parseFloat(String(value))
  return isNaN(n) ? "" : String(Math.round(n))
}

function celsiusToFahrenheit(value) {
  if (value === undefined || value === null || value === "") return ""
  var n = parseFloat(String(value))
  return isNaN(n) ? "" : (n * 9 / 5) + 32
}

// fmt writes the number for display (QML passes I18n.formatNumber, so a
// Persian reading gets Persian digits); left out, it is written as it is.
function displayNumber(fmt) {
  return typeof fmt === "function" ? fmt : function(v, d) { return d === undefined ? String(v) : Number(v).toFixed(d) }
}

function formatTemp(value, useImperial, fmt) {
  if (value === undefined || value === null || value === "") return ""
  return displayNumber(fmt)(value) + "°" + (useImperial ? "F" : "C")
}

function normalizedUnit(value) {
  return String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase()
}

function localeUsesImperial(localeName) {
  var name = String(localeName || "").replace(".", "_")
  return /^en[_-]US($|[_.-])/.test(name) || /^en[_-]LR($|[_.-])/.test(name) || /^my($|[_.-])/.test(name)
}

function countryUsesImperial(countryName) {
  var country = String(countryName || "")
    .replace(/^\s+|\s+$/g, "")
    .replace(/[._-]+/g, " ")
    .toLowerCase()
  if (!country) return null
  if (country === "us" || country === "usa" || country === "united states" || country === "united states of america") return true
  if (country === "liberia" || country === "myanmar" || country === "burma") return true
  return false
}

function shouldUseImperial(unitOverride, localeName, countryName) {
  var unit = normalizedUnit(unitOverride)
  if (unit === "imperial") return true
  if (unit === "metric") return false

  var countryPreference = countryUsesImperial(countryName)
  if (countryPreference !== null) return countryPreference

  return localeUsesImperial(localeName)
}

function dayName(dateString, formatter) {
  if (!dateString) return ""
  var d = new Date(dateString + "T12:00:00")
  if (isNaN(d.getTime())) return ""
  if (formatter) return formatter(d)
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()]
}

function openMeteoForecastDays(dailyForecastReport, todayString) {
  var daily = dailyForecastReport && dailyForecastReport.daily ? dailyForecastReport.daily : null
  if (!daily || !daily.time) return []

  var result = []
  for (var i = 0; i < daily.time.length && result.length < 3; ++i) {
    var date = daily.time[i]
    if (!isFutureForecastDate(date, todayString)) continue

    var maxC = daily.temperature_2m_max ? daily.temperature_2m_max[i] : ""
    var minC = daily.temperature_2m_min ? daily.temperature_2m_min[i] : ""
    result.push({
      date: date,
      maxtempC: roundedTemp(maxC),
      mintempC: roundedTemp(minC),
      maxtempF: roundedTemp(celsiusToFahrenheit(maxC)),
      mintempF: roundedTemp(celsiusToFahrenheit(minC)),
      openMeteoWeatherCode: daily.weather_code ? daily.weather_code[i] : null
    })
  }
  return result
}

// Open-Meteo bundles current conditions with the daily forecast request and
// answers far faster than wttr.in. Normalize them to wttr's
// current_condition shape so the panel can use either source
// interchangeably. Open-Meteo reports metric (°C, km/h).
function openMeteoCurrentCondition(dailyForecastReport) {
  var current = dailyForecastReport && dailyForecastReport.current ? dailyForecastReport.current : null
  if (!current || current.temperature_2m === undefined || current.temperature_2m === null) return null
  return {
    temp_C: roundedTemp(current.temperature_2m),
    temp_F: roundedTemp(celsiusToFahrenheit(current.temperature_2m)),
    FeelsLikeC: roundedTemp(current.apparent_temperature),
    FeelsLikeF: roundedTemp(celsiusToFahrenheit(current.apparent_temperature)),
    windspeedKmph: roundedTemp(current.wind_speed_10m),
    windspeedMiles: roundedTemp(current.wind_speed_10m * 0.621371),
    humidity: roundedTemp(current.relative_humidity_2m),
    openMeteoWeatherCode: current.weather_code,
    isDay: current.is_day
  }
}

function currentIcon(current, fallback) {
  if (!current) return fallback || ""
  if (current.openMeteoWeatherCode !== undefined && current.openMeteoWeatherCode !== null)
    return iconForOpenMeteoCode(current.openMeteoWeatherCode, Number(current.isDay) === 0)
  if (current.weatherCode !== undefined && current.weatherCode !== null)
    return iconForCode(current.weatherCode, false)
  return fallback || ""
}

// wttr.in has no day/night flag. Use its icon only to fill an empty initial
// state, never to replace a day/night-aware icon resolved by Open-Meteo.
function provisionalCurrentIcon(current, resolvedIcon) {
  return resolvedIcon || currentIcon(current, "")
}

function weatherResponseCompletesSave(hasConfiguredCoordinates, source) {
  return hasConfiguredCoordinates ? source === "open-meteo" : source === "wttr"
}

// Open-Meteo sunrise/sunset values are naive local times ("2026-11-10T06:47")
// in the forecast location's zone. utc_offset_seconds turns that clock time
// into an instant. Without an offset, fall back to the machine's local zone.
function parseLocationInstant(iso, utcOffsetSeconds) {
  var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso || ""))
  if (!match) return NaN
  var offset = Number(utcOffsetSeconds)
  if (!isFinite(offset)) {
    var parsed = Date.parse(String(iso))
    return isNaN(parsed) ? NaN : parsed
  }
  return Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]) - offset * 1000
}

// 12-hour clock with AM/PM. Midnight is 12:00 AM and noon is 12:00 PM.
// The hour has no leading zero, matching the bar clock's "h:mm AP".
function clockFromIso(iso) {
  var match = /T(\d{2}):(\d{2})/.exec(String(iso || ""))
  if (!match) return ""
  var hour = +match[1]
  var suffix = hour < 12 ? "AM" : "PM"
  var hour12 = hour % 12
  if (hour12 === 0) hour12 = 12
  return hour12 + ":" + match[2] + " " + suffix
}

// The next sunrise or sunset still ahead of nowMs. A missing time (polar day
// or night) is skipped. After today's sunset this returns tomorrow's sunrise
// when the daily forecast includes it.
function upcomingSunEvent(dailyForecastReport, nowMs) {
  var daily = dailyForecastReport && dailyForecastReport.daily
  if (!daily) return null
  var rises = daily.sunrise || []
  var sets = daily.sunset || []
  var count = Math.max(rises.length, sets.length)
  if (!count) return null

  var offset = dailyForecastReport.utc_offset_seconds
  var now = typeof nowMs === "number" && isFinite(nowMs) ? nowMs : Date.now()
  for (var i = 0; i < count; i++) {
    var riseAt = parseLocationInstant(rises[i], offset)
    var setAt = parseLocationInstant(sets[i], offset)
    if (!isNaN(riseAt) && now < riseAt)
      return { kind: "sunrise", clock: clockFromIso(rises[i]), at: riseAt }
    if (!isNaN(setAt) && now < setAt)
      return { kind: "sunset", clock: clockFromIso(sets[i]), at: setAt }
  }
  return null
}

function sunBarLabel(dailyForecastReport, nowMs) {
  var event = upcomingSunEvent(dailyForecastReport, nowMs)
  if (!event || !event.clock) return ""
  return (event.kind === "sunrise" ? "\u2191 " : "\u2193 ") + event.clock
}

function formatSpan(ms) {
  var minutes = Math.max(0, Math.round(Math.abs(Number(ms) || 0) / 60000))
  if (minutes <= 0) return "0m"
  var hours = Math.floor(minutes / 60)
  var mins = minutes % 60
  if (hours <= 0) return mins + "m"
  if (mins === 0) return hours + "h"
  return hours + "h " + mins + "m"
}

// "in 7h 56m" while the event is ahead, "5h 44m ago" once it has passed.
function relativeWhen(ms, future) {
  if (formatSpan(ms) === "0m") return "now"
  return future ? "in " + formatSpan(ms) : formatSpan(ms) + " ago"
}

// Every sunrise and sunset in the forecast, oldest first. Missing polar
// times are skipped. Instants use the location's utc offset. `day` is the
// location's calendar date, taken from the naive ISO rather than the machine.
function sunTimeline(dailyForecastReport) {
  var daily = dailyForecastReport && dailyForecastReport.daily
  if (!daily) return []
  var offset = dailyForecastReport.utc_offset_seconds
  var rises = daily.sunrise || []
  var sets = daily.sunset || []
  var count = Math.max(rises.length, sets.length)
  var events = []
  for (var i = 0; i < count; i++) {
    var riseAt = parseLocationInstant(rises[i], offset)
    var setAt = parseLocationInstant(sets[i], offset)
    if (!isNaN(riseAt)) events.push({ kind: "sunrise", at: riseAt, clock: clockFromIso(rises[i]), day: dayFromIso(rises[i]) })
    if (!isNaN(setAt)) events.push({ kind: "sunset", at: setAt, clock: clockFromIso(sets[i]), day: dayFromIso(sets[i]) })
  }
  events.sort(function(a, b) { return a.at - b.at })
  return events
}

function dayFromIso(iso) {
  var match = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso || ""))
  return match ? match[1] : ""
}

// Calendar date at the forecast location. Open-Meteo gives one offset for
// the response; the spring-forward night is an hour off for that one day.
function locationDay(ms, utcOffsetSeconds) {
  var offset = Number(utcOffsetSeconds)
  if (!isFinite(offset)) offset = 0
  return new Date(ms + offset * 1000).toISOString().slice(0, 10)
}

function dayRelation(eventDay, today) {
  if (!eventDay || !today || eventDay === today) return ""
  var eventUtc = Date.parse(eventDay + "T00:00:00Z")
  var todayUtc = Date.parse(today + "T00:00:00Z")
  if (!isFinite(eventUtc) || !isFinite(todayUtc)) return ""
  var days = Math.round((eventUtc - todayUtc) / 86400000)
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  return ""
}

function eventOnDay(events, day, kind) {
  for (var i = 0; i < events.length; i++) {
    if (events[i].day === day && events[i].kind === kind) return events[i]
  }
  return null
}

// Hours of curve kept outside the first and last labeled crossing, so the
// wave meets the horizon inside the card instead of at the corner.
var SUN_CHART_PAD_MS = 3 * 60 * 60 * 1000

// Signed height of the sun's path. +1 is the middle of the day, -1 is the
// middle of the night, 0 is the horizon. Day and night each get their own
// half-period, because a single 24h sine only crosses zero every 12 hours
// and would miss sunrise and sunset except at the equinox. The peak is the
// midpoint of sunrise and sunset (solar noon), not 12:00 on the clock.
function solarHeight(curve, fraction) {
  if (!curve || !curve.events) return 0
  var span = curve.windowEnd - curve.windowStart
  if (!(span > 0)) return 0
  var t = curve.windowStart + Number(fraction) * span
  var events = curve.events
  var prev = null
  var next = null
  for (var i = 0; i < events.length; i++) {
    if (events[i].at <= t) prev = events[i]
    else if (!next) next = events[i]
  }
  if (!prev || !next || prev.kind === next.kind) return 0
  var gap = next.at - prev.at
  if (!(gap > 0)) return 0
  var wave = Math.sin(Math.PI * ((t - prev.at) / gap))
  if (Math.abs(wave) < 1e-9) return 0
  return prev.kind === "sunrise" ? wave : -wave
}

// Where `now` sits between the surrounding sunrise and sunset.
function solarPhase(prev, next, now) {
  if (!prev || !next || !(next.at > prev.at)) return ""
  var progress = (now - prev.at) / (next.at - prev.at)
  var day = prev.kind === "sunrise"
  if (progress < 0.12) return day ? "Just after sunrise" : "Just after sunset"
  // Night's "evening" runs a little further than the day's "morning":
  // solar midnight is the trough, and 10pm is still on the way down to it.
  if (day) {
    if (progress < 0.35) return "Morning"
    if (progress < 0.62) return "Midday"
    if (progress < 0.85) return "Afternoon"
    return "Just before sunset"
  }
  if (progress < 0.42) return "Evening"
  if (progress < 0.65) return "Middle of the night"
  if (progress < 0.85) return "Late night"
  return "Almost sunrise"
}

// About 30 hours of a skewed sine: three hours of approach, one solar day,
// three hours of departure. Before sunrise the slice is yesterday's sunset
// through today's sunset. From sunrise on it is today's sunrise through
// tomorrow's sunrise. The slice changes at sunrise.
function daylightCurve(dailyForecastReport, nowMs) {
  var now = typeof nowMs === "number" && isFinite(nowMs) ? nowMs : Date.now()
  var events = sunTimeline(dailyForecastReport)
  if (!events.length || !dailyForecastReport) return null

  var today = locationDay(now, dailyForecastReport.utc_offset_seconds)
  var todayRise = eventOnDay(events, today, "sunrise")
  var todaySet = eventOnDay(events, today, "sunset")
  if (!todayRise || !todaySet) return null

  var yesterdaySet = null
  var tomorrowRise = null
  for (var i = 0; i < events.length; i++) {
    if (events[i].kind === "sunset" && events[i].at < todayRise.at) yesterdaySet = events[i]
    if (!tomorrowRise && events[i].kind === "sunrise" && events[i].at > todaySet.at) tomorrowRise = events[i]
  }

  var anchorStart = null
  var anchorEnd = null
  if (now < todayRise.at) {
    if (!yesterdaySet) return null
    anchorStart = yesterdaySet
    anchorEnd = todaySet
  } else {
    if (!tomorrowRise) return null
    anchorStart = todayRise
    anchorEnd = tomorrowRise
  }

  var windowStart = anchorStart.at - SUN_CHART_PAD_MS
  var windowEnd = anchorEnd.at + SUN_CHART_PAD_MS
  var span = windowEnd - windowStart
  if (!(span > 0) || now < windowStart || now > windowEnd) return null

  var prev = null
  var next = null
  for (var n = 0; n < events.length; n++) {
    if (events[n].at <= now) prev = events[n]
    else if (!next) next = events[n]
  }
  if (!prev || !next || prev.kind === next.kind) return null

  var markers = []
  for (var m = 0; m < events.length; m++) {
    var event = events[m]
    if (event.at < windowStart || event.at > windowEnd) continue
    var role = "context"
    if (event.at === prev.at && event.kind === prev.kind) role = "prev"
    else if (event.at === next.at && event.kind === next.kind) role = "next"
    // The previous and next crossings keep "6h ago" / "in 7h". A third
    // crossing that already happened is just context, so it says when in
    // the day it was instead of a long elapsed time.
    var when = relativeWhen(event.at - now, event.at > now)
    if (role === "context" && event.at <= now)
      when = event.kind === "sunrise" ? "this morning" : "earlier"
    markers.push({
      kind: event.kind,
      clock: event.clock,
      when: when,
      relation: dayRelation(event.day, today),
      role: role,
      fraction: (event.at - windowStart) / span
    })
  }
  if (markers.length < 2) return null

  return {
    windowStart: windowStart,
    windowEnd: windowEnd,
    nowFraction: (now - windowStart) / span,
    phase: solarPhase(prev, next, now),
    events: events.map(function(event) { return { kind: event.kind, at: event.at } }),
    markers: markers
  }
}

function wttrNextForecastDays(report, todayString) {
  var days = report && report.weather ? report.weather : []
  var result = []
  for (var i = 0; i < days.length && result.length < 3; ++i) {
    if (isFutureForecastDate(days[i].date, todayString)) result.push(days[i])
  }
  return result
}

function buildForecastDays(report, dailyForecastReport, todayString) {
  var days = openMeteoForecastDays(dailyForecastReport, todayString)
  return days.length > 0 ? days : wttrNextForecastDays(report, todayString)
}

function bareTempForDay(day, kind, useImperial, fmt) {
  if (!day) return ""
  var v = useImperial
    ? (kind === "max" ? day.maxtempF : day.mintempF)
    : (kind === "max" ? day.maxtempC : day.mintempC)
  if (v === undefined || v === null || v === "") return ""
  return displayNumber(fmt)(v) + "°"
}

function dayIcon(day) {
  if (!day) return ""
  if (day.openMeteoWeatherCode !== undefined && day.openMeteoWeatherCode !== null)
    return iconForOpenMeteoCode(day.openMeteoWeatherCode)
  if (!day.hourly || day.hourly.length === 0) return ""

  var best = day.hourly[0]
  var bestDist = 9999
  for (var i = 0; i < day.hourly.length; ++i) {
    var t = parseInt(String(day.hourly[i].time || "0"), 10)
    var dist = Math.abs(t - 1200)
    if (dist < bestDist) {
      bestDist = dist
      best = day.hourly[i]
    }
  }
  return iconForCode(best.weatherCode, false)
}

function iconForOpenMeteoCode(code, night) {
  var c = parseInt(String(code || "0"), 10)
  if (c === 0) return iconForCode(113, night)
  if (c === 1 || c === 2) return iconForCode(116, night)
  if (c === 3) return iconForCode(119, night)
  if (c === 45 || c === 48) return iconForCode(143, night)
  if (c === 51 || c === 53 || c === 55 || c === 56 || c === 57 || c === 61) return iconForCode(266, night)
  if (c === 63 || c === 65 || c === 66 || c === 67 || c === 80 || c === 81 || c === 82) return iconForCode(308, night)
  if (c === 71 || c === 73 || c === 75 || c === 77 || c === 85 || c === 86) return iconForCode(338, night)
  if (c === 95 || c === 96 || c === 99) return iconForCode(389, night)
  return iconForCode(119, night)
}

function iconForCode(code, night) {
  var c = parseInt(String(code || "0"), 10)
  switch (c) {
    case 113: return night ? "" : ""
    case 116: return night ? "" : ""
    case 119: case 122: return ""
    case 143: case 248: case 260: return night ? "\ue346" : "\ue313"
    case 176: case 263: case 353: return night ? "" : ""
    case 179: case 227: case 230: case 323: case 326: case 368: return night ? "" : ""
    case 182: case 185: case 281: case 284: case 311: case 314:
    case 317: case 320: case 350: case 362: case 365: case 374: case 377: return ""
    case 200: case 386: case 389: case 392: case 395: return ""
    case 266: case 293: case 296: case 299: case 302: case 305: case 308: case 356: case 359: return ""
    case 329: case 332: case 335: case 338: case 371: return ""
    default: return ""
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    parseLocationFile: parseLocationFile,
    isAutoLocation: isAutoLocation,
    effectiveLocation: effectiveLocation,
    wttrLocationQuery: wttrLocationQuery,
    parseGeocodingResults: parseGeocodingResults,
    locationCommit: locationCommit,
    isFutureForecastDate: isFutureForecastDate,
    roundedTemp: roundedTemp,
    celsiusToFahrenheit: celsiusToFahrenheit,
    formatTemp: formatTemp,
    normalizedUnit: normalizedUnit,
    localeUsesImperial: localeUsesImperial,
    countryUsesImperial: countryUsesImperial,
    shouldUseImperial: shouldUseImperial,
    dayName: dayName,
    openMeteoForecastDays: openMeteoForecastDays,
    openMeteoCurrentCondition: openMeteoCurrentCondition,
    currentIcon: currentIcon,
    provisionalCurrentIcon: provisionalCurrentIcon,
    weatherResponseCompletesSave: weatherResponseCompletesSave,
    parseLocationInstant: parseLocationInstant,
    clockFromIso: clockFromIso,
    upcomingSunEvent: upcomingSunEvent,
    sunBarLabel: sunBarLabel,
    formatSpan: formatSpan,
    relativeWhen: relativeWhen,
    sunTimeline: sunTimeline,
    solarHeight: solarHeight,
    solarPhase: solarPhase,
    daylightCurve: daylightCurve,
    wttrNextForecastDays: wttrNextForecastDays,
    buildForecastDays: buildForecastDays,
    bareTempForDay: bareTempForDay,
    dayIcon: dayIcon,
    iconForOpenMeteoCode: iconForOpenMeteoCode,
    iconForCode: iconForCode
  }
}
