# broadcast-overlay

Knihovna pro řízení dynamické grafiky ve vysílání přes OBS (Browser Source). Server, režie i vysílací
stránky dodává knihovna; vlastní features, komponenty a scény se registrují přes typované API.

```bash
pnpm install
pnpm dev
```

- režie: http://localhost:4000/scene/main
- vysílací stránka pro OBS (1920×1080, průhledná): http://localhost:4000/scene/main/broadcast

Architektura a otevřené otázky: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
