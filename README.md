# matt.weather

Personal Omarchy bar widget, cloned from `omarchy.weather`.

The pill keeps the weather icon and adds the next sun time beside it. Before sunrise it shows sunrise (`↑ 06:47`). From sunrise until sunset it shows sunset. After sunset it shows tomorrow's sunrise. On a vertical bar it stays icon-only.

Times come from the Open-Meteo daily forecast, in the weather location's own zone. The label is recomputed every 30 seconds, so it flips at the event without waiting for the next forecast refresh.

The clone lives at `~/.config/omarchy/plugins/matt.weather` and replaces the stock weather pill. Edits in this directory reload in the shell on save.

```bash
node test/sun.js
```

Omarchy's weather widget is MIT. See `LICENSE`.
