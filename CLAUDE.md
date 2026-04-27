# Project updates (2026-04-25)

This file summarizes the changes made during the latest iteration on the Three.js portfolio background + scroll transitions.

## Planet scene + loading

- **Preload all planet textures**: texture loads are started in parallel and cached, then applied to existing meshes when they arrive.
- **All planets exist in the scene at once**: planets are created once at startup and placed along a Z “rail” so they can be seen in the distance.
  - `planetsRail` holds every `planet:<section>` group.
  - Spacing is controlled by `PLANET_SPACING_Z`.
- **No per-section rebuild/dispose**: removed the previous approach that removed/created meshes per section change.

## Transitions + fast scroll behavior

- **No lateral panning**: section transitions are depth/rail-based (no X pan).
- **No skipping planets**: rapid scroll uses a `sectionQueue` so moving from `hero` → `work` will traverse `about` → `skills` → `work`.
- **Keeps up with fast scrolling**:
  - Requests within `FAST_SCROLL_WINDOW_MS` apply a `FAST_SCROLL_SPEEDUP` multiplier to shorten durations.
- **Removed “springy” overshoot**:
  - Removed the overshoot component and simplified the transition to a single move to the target rail position.

## Rotation changes

- **Removed spring rotation**: replaced spring physics with direct per-section spin using `restingSpin`.
- **Axial tilt**: each planet is created with a constant axial tilt:
  - `AXIAL_TILT_RAD = degToRad(23.5)`

## Ring texture fix (Saturn ring)

- **Fixed ring UVs applying too late**: ring UV remapping now runs unconditionally when the ring geometry is created (textures load asynchronously).

## Scroll smoothing (HTML/CSS)

- **Longer scroll sections**: increased per-section vertical space so the IntersectionObserver doesn’t advance multiple sections too easily.
  - `section { min-height: 180vh; padding: 10rem 0; }`

