# RollerGhoster — The Last Ride

> One seat. Six sections. The house has been waiting for you.

**Play:** [joramvanloenen.github.io/RollerGhoster/](https://joramvanloenen.github.io/RollerGhoster/)

A dark, cinematic first-person rollercoaster ride through Blackthorn Estate. Built from procedural Three.js geometry with no downloaded 3D models or prerecorded audio files.

## The ride

- A complete spline-based coaster circuit with twin rails, sleepers, supports and carriage. Forward speed is integrated from **gravity projected onto track slope, rolling resistance, aerodynamic drag, lift chain traction, station drive tyres and magnetic brakes**. It is never overwritten by a hard-coded speed profile.
- Six haunted environments: boarding house, watching gallery, forgotten nursery, Blackthorn drop, family crypt and the last exit.
- Gothic corridors, masonry, timber panelling, lanterns, portraits, coffins, abandoned cots, statues, grave markers, dead trees, moving double doors, floating spectres, dust and fog.
- **Two camera-mounted spotlights** that aim where you look and briefly malfunction during frightening moments.
- Jump scares triggered during slow, quiet parts of the circuit, with a distorted close-up apparition, screen flash, camera disturbance and synthesized audio stinger. Choose **FULL** or **MILD** intensity before boarding.
- Force-driven procedural Web Audio: rail resonance, wheel bearing vibration, air buffeting (speed²), wheel flange squeal under lateral G load, rail-sleeper clacks spaced every 2.25 m, doubled rail-joint knocks every 13.5 m, lift ratchet ticks and magnetic-brake hiss. Quiet stretches really become quieter. Jump scares use a separate short shock impact/breath. Audio starts only after a button press.
- Responsive first-person UI with elapsed time, velocity, calculated G-load, ride progress, chapter and location information; mobile drag-to-look support.
- Scenery clearance checks against the complete swept car path keep walls, scenery and vertical supports out of the vehicle's envelope—even where the track doubles back near an earlier corridor. Doors swing fully open well before the train arrives. No build step, account, backend, cookies or data storage.

## Controls

| Input | Action |
| --- | --- |
| **Drag mouse / swipe screen** | Look around from the car |
| **F** or **Lights** button | Toggle both camera flashlights |
| **M** or **Sound** button | Mute/unmute audio |
| **Space** or **Pause** button | Pause/resume the ride |
| **R** | Restart |
| **Board the car** | Start / unlock audio |
| **Scare level: Full / Mild** | Milder mode removes half of jump scares |

Headphones are recommended. **Warning:** Sudden scares, loud audio effects and flashing imagery. Prefers-reduced-motion minimizes camera motion.

## Run locally

This is a static site. Serve it over HTTP because it uses ES modules:

    python -m http.server 8000

Then open http://localhost:8000. The Three.js ES module is fetched from jsDelivr, so an internet connection is required.

## Deploy

The workflow in [.github/workflows/pages.yml](.github/workflows/pages.yml) publishes the root of the repository to GitHub Pages on each push to main. If Pages is not enabled yet, open **Repository Settings → Pages → Build and deployment → GitHub Actions** once.

The deployment URL is expected to be https://joramvanloenen.github.io/RollerGhoster/ after a successful Pages run.

## Implementation

The visual and audio experience is self-contained in [src/main.js](src/main.js); the UI and accessibility styles are in [styles.css](styles.css). All textures (portraits, spectres, masonry, signs) are painted onto in-memory canvases, and all sound is synthesized in the browser.

Built with [Three.js](https://threejs.org/) and standard Web Audio.
## Physics validation

Run `node --test tests/physics.test.mjs` locally. The Pages deployment also runs these deterministic tests before publishing. The model is a simplified ride simulation with powered lift/drive sections; it is not an engineering-grade structural or safety simulator.
