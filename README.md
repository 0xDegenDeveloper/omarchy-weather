# matt.weather

Personal Omarchy bar widget, cloned from `omarchy.weather`.

The bar pill stays the weather icon. Under the forecast, a sine crosses a dotted horizon at sunrise and sunset: above the line is day, below it is night. The peak is halfway through the daylight, the trough halfway through the night. A dot marks now, and the crossings in view are labeled with the clock time and how long ago or how soon. From sunrise onward that view is this morning through tomorrow morning. Before sunrise it is yesterday's sunset through today's sunset.

Times come from the Open-Meteo daily forecast, in the weather location's own zone, shown as 12-hour clock time with AM/PM. The label is recomputed every 30 seconds, so it flips at the event without waiting for the next forecast refresh.

The clone lives at `~/.config/omarchy/plugins/matt.weather` and replaces the stock weather pill. Edits in this directory reload in the shell on save.

```bash
node test/sun.js
```

Omarchy's weather widget is MIT. See `LICENSE`.
