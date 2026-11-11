# matt.weather

Personal Omarchy bar widget, cloned from `omarchy.weather`.

The bar pill stays the weather icon. Click it and the popup still shows the next sun time beside the city. Under the forecast, a second section draws the same day as a curve: daylight is the arch, night is the baseline, and a dot marks where the sun is now. The previous event and the next one sit on that curve with their clock time and how long ago or how soon.

Times come from the Open-Meteo daily forecast, in the weather location's own zone. The label is recomputed every 30 seconds, so it flips at the event without waiting for the next forecast refresh.

The clone lives at `~/.config/omarchy/plugins/matt.weather` and replaces the stock weather pill. Edits in this directory reload in the shell on save.

```bash
node test/sun.js
```

Omarchy's weather widget is MIT. See `LICENSE`.
