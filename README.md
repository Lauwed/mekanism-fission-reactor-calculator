# ⚛ Mekanism Fusion Reactor — Calculateur de carburant

Calcule la consommation de D-T Fuel et la production d'énergie du réacteur de fusion de **Mekanism** (Minecraft) en fonction du taux d'injection.

> **Vibe coded** avec Claude Code — les formules viennent du [wiki FTB](https://ftb.fandom.com/wiki/Fusion_Reactor_(Mekanism)), l'interface a été générée par IA.

## Fonctionnalités

- Slider d'**injection rate** (2–98, pairs uniquement) pour le mixage interne D + T
- Slider de **débit D-T Fuel** (1–1 000 mB/t) pour l'injection directe de carburant pré-mixé
- Choix du mode de refroidissement : **air-cooled** ou **water-cooled** (+ Industrial Turbine)
- Consommation de Deutérium, Tritium et D-T Fuel par tick / seconde / minute / heure
- Production d'énergie en FE/t avec détail turbine + direct en water-cooled
- Fiches explicatives complètes sur toutes les formules et mécaniques du réacteur

## Stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/)
- CSS vanilla, zéro dépendance UI

## Lancer en local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```
