import assert from "node:assert/strict";
import { computeRideForces, integrateRide, GRAVITY, trackHardware } from "../src/physics.mjs";

const eps = (a,b,tolerance=.02) => assert.ok(Math.abs(a-b)<tolerance, String(a)+" not near "+String(b));

// Gravity accelerates a descending car and opposes a climbing one.
const downhill = computeRideForces(.36, 10, -.4);
const uphill = computeRideForces(.36, 10, .4);
assert.ok(downhill.acceleration > 0);
assert.ok(uphill.acceleration < 0);
eps(downhill.gravityAcceleration, GRAVITY*.4);
eps(uphill.gravityAcceleration, -GRAVITY*.4);

// Passive drag should increase with speed. Brakes should apply a negative force.
assert.ok(computeRideForces(.36,20,0).airResistance > computeRideForces(.36,10,0).airResistance);
assert.ok(computeRideForces(.42,19,-.5).braking > 0);
assert.equal(trackHardware(.28)?.type,"lift");
assert.equal(trackHardware(.62)?.type,"lift");
assert.equal(trackHardware(.77)?.type,"brake");

// Higher speed and curvature both increase centripetal load.
assert.ok(computeRideForces(.36,20,0,.04,.03).totalG > computeRideForces(.36,7,0,.04,.03).totalG);

// Integrator is stable and independent of FPS for a smooth slope.
const sample = ()=>({grade:-.25,verticalCurvature:0,lateralCurvature:0});
let a={distance:300,speed:8},b={...a};
for(let i=0;i<60;i++)a=integrateRide(a,1/60,900,sample);
for(let i=0;i<30;i++)b=integrateRide(b,1/30,900,sample);
eps(a.distance,b.distance,.05);
eps(a.speed,b.speed,.05);

// A drive segment must be capable of accelerating the car from a standstill.
let c={distance:0,speed:0};
for(let i=0;i<300;i++)c=integrateRide(c,1/60,900,()=>({grade:0,verticalCurvature:0,lateralCurvature:0}));
assert.ok(c.speed>2.5);
console.log("RollerGhoster physics tests passed");
