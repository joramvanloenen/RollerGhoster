/**
 * RollerGhoster ride model.
 *
 * Distances: metres. Speed: metres/second. Acceleration: metres/second².
 * The track geometry supplies grade (unit tangent Y) and curvature (1/metre).
 * Free motion obeys gravity, rolling resistance and aerodynamic drag.
 * The lift, drive-tyre and magnetic-brake zones are explicit powered hardware,
 * not scripted speed curves. They act as forces, not instantaneous speed resets.
 */
export const GRAVITY = 9.81;
export const ROLLING_COEFFICIENT = 0.023;
export const AERO_DRAG = 0.0023; // m^-1, adjusted for a small exposed train
export const SLEEPER_SPACING = 2.25;
export const JOINT_SPACING = 13.5;

function clamp(x, low, high) {
  return Math.min(high, Math.max(low, x));
}

const hardware = [
  // The boarding tyres briskly launch the train before the first powered lift.
  { from: 0, to: 0.115, type: "drive", target: 10.5, maxForce: 5.0 },
  { from: 0.115, to: 0.33, type: "lift", target: 11.3, maxForce: 12.5 },
  // Hard braking happens AFTER the thrill of the drop, not on the crest.
  { from: 0.416, to: 0.459, type: "brake", target: 8.0, maxForce: 9.3 },
  { from: 0.448, to: 0.581, type: "drive", target: 9.6, maxForce: 4.5 },
  { from: 0.579, to: 0.690, type: "lift", target: 11.1, maxForce: 13.8 },
  { from: 0.774, to: 0.827, type: "brake", target: 9.0, maxForce: 8.8 },
  { from: 0.812, to: 0.968, type: "drive", target: 10.3, maxForce: 4.5 },
  { from: 0.968, to: 1, type: "brake", target: 6.0, maxForce: 4.3 }
];

export function trackHardware(progress) {
  // Brakes get priority in an overlap; lifts always override ordinary drive tyres.
  const active = hardware.filter(h => progress >= h.from && progress < h.to);
  return active.find(h => h.type === "brake") ||
    active.find(h => h.type === "lift") ||
    active[0] || null;
}

export function computeRideForces(progress, speed, grade, verticalCurvature = 0, lateralCurvature = 0) {
  speed = Math.max(0, speed);
  grade = clamp(grade, -1, 1);
  const tangentUp = Math.sqrt(Math.max(0, 1 - grade * grade));
  const gravityAcceleration = -GRAVITY * grade;
  const verticalG = Math.max(0, tangentUp + speed * speed * verticalCurvature / GRAVITY);
  const lateralG = Math.abs(speed * speed * lateralCurvature / GRAVITY);
  const normalLoad = GRAVITY * Math.max(0.28, Math.hypot(verticalG, lateralG));
  const rollingResistance = ROLLING_COEFFICIENT * normalLoad;
  const airResistance = AERO_DRAG * speed * speed;
  const passiveAcceleration = gravityAcceleration - rollingResistance - airResistance;
  let traction = 0, braking = 0;
  const unit = trackHardware(progress);
  if (unit?.type === "brake") {
    const excess = Math.max(0, speed - unit.target);
    braking = Math.min(unit.maxForce, excess * 2.6);
    // Low-speed tyre drives remain available so a train can never strand itself.
    if (speed < 2.4) traction = Math.min(1.8, (2.4 - speed) * 2);
  } else if (unit) {
    const error = unit.target - speed;
    traction = clamp(error * (unit.type === "lift" ? 3.2 : 1.7), 0, unit.maxForce);
    if (unit.type === "lift" && error < -0.6) braking = Math.min(1.8, (-error - 0.6) * 1.1);
  }
  const acceleration = passiveAcceleration + traction - braking;
  return {
    acceleration,
    gravityAcceleration,
    rollingResistance,
    airResistance,
    traction,
    braking,
    verticalG,
    lateralG,
    totalG: Math.hypot(verticalG, lateralG),
    mode: braking > .05 && unit?.type === "brake" ? "brake" : unit?.type || "coast",
    wheelHz: speed / SLEEPER_SPACING,
    jointHz: speed / JOINT_SPACING
  };
}

export function integrateRide(state, dt, trackLength, sample) {
  // Semi-implicit midpoint integration with small substeps keeps the coaster
  // smooth and avoids frame-rate-dependent energy gains at crests and drops.
  dt = clamp(dt, 0, .08);
  let distance = clamp(state.distance, 0, trackLength);
  let speed = Math.max(0, state.speed);
  let forces = computeRideForces(0, speed, 0);
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps && distance < trackLength; i++) {
    const x = clamp(distance / trackLength, 0, 1);
    const local = sample(x);
    const f0 = computeRideForces(x, speed, local.grade, local.verticalCurvature, local.lateralCurvature);
    const vMid = Math.max(0, speed + f0.acceleration * h * .5);
    const dMid = Math.min(trackLength, distance + vMid * h * .5);
    const midpoint = sample(dMid / trackLength);
    const fMid = computeRideForces(dMid / trackLength, vMid, midpoint.grade, midpoint.verticalCurvature, midpoint.lateralCurvature);
    const nextSpeed = Math.max(0, speed + fMid.acceleration * h);
    distance = Math.min(trackLength, distance + (speed + nextSpeed) * .5 * h);
    speed = nextSpeed;
    forces = fMid;
  }
  if (distance >= trackLength) speed = 0;
  return { distance, speed, progress: distance / trackLength, forces };
}
