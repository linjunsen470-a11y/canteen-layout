# Canteen Layout Studio

A browser-based 2D/3D space planner for canteens, staff restaurants, food-service counters and commercial interiors.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local Vite URL printed in the terminal. Production build: `npm run build`; preview: `npm run preview`.

## Current implementation

- React + TypeScript + Vite desktop workspace.
- Shared project model; dimensions and positions are stored in millimetres.
- SVG 2D floor-plan editor with selectable and draggable furniture and zones.
- Furniture catalog with editable dimensions, height, coordinates, rotation and color.
- 3D scene rendered from the same project data using Three.js via React Three Fiber; orbit, zoom and pan controls.
- Undo/redo, local browser save/restore, JSON import/export and PNG plan export.
- Responsive 2D / split / 3D view modes.

## Notes

The current build is an early functional foundation. Multi-select, precision alignment, wall/door/window editing, dimension annotations, persistent reusable custom catalog entries, IndexedDB project library, 3D screenshot export and advanced area polygon editing remain future work.
