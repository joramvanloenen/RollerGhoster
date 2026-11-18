import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser=await chromium.launch({
  headless:true,
  args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]
});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text());});
try {
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"load",timeout:45000});
  await page.waitForFunction(()=>Boolean(window.__RollerGhosterDebug),{timeout:45000});
  const before=await page.evaluate(()=>{
    const d=window.__RollerGhosterDebug;
    let meshCount=0,treeMeshes=0;
    d.scene.traverse(o=>{
      if(o.isMesh){
        meshCount++;
        if(o.geometry?.attributes?.position?.count>900)treeMeshes++;
      }
    });
    return {meshCount,treeMeshes,exposure:d.renderer.toneMappingExposure,
      fog:d.scene.fog.density,track:d.trackLength};
  });
  assert.ok(before.meshCount>600,"Missing the rebuilt environment");
  assert.ok(before.treeMeshes>=15,"The tree geometry did not load");
  assert.ok(before.exposure<.9,"Ride is no longer dark enough");
  assert.ok(before.fog>.035,"Dark atmospheric fog is missing");
  await page.click("#startRide",{timeout:8000});
  await page.waitForTimeout(1700);
  const ride=await page.evaluate(()=>{
    const d=window.__RollerGhosterDebug;
    return {speed:d.state.speed,progress:d.state.progress,playing:d.state.playing,
      soundReady:!!(d.state.soundOn),wheelSpeed:d.state.forces?.totalG};
  });
  assert.ok(ride.playing&&ride.progress>0&&ride.speed>1,"Ride did not move");
  await page.evaluate(()=>{
    const d=window.__RollerGhosterDebug;
    d.state.paused=true;
    d.state.progress=.35;
    d.state.distance=.35*d.trackLength;
  });
  await page.waitForTimeout(220);
  await page.screenshot({path:"/tmp/rollerghoster-forest.png",animations:"disabled"});
  await page.evaluate(()=>{
    const d=window.__RollerGhosterDebug;
    d.state.progress=.77;
    d.state.distance=.77*d.trackLength;
  });
  await page.waitForTimeout(220);
  await page.screenshot({path:"/tmp/rollerghoster-crypt.png",animations:"disabled"});
  assert.deepEqual(errors,[],"Page errors encountered during WebGL playback");
  console.log("Browser/WebGL ride smoke test passed:",JSON.stringify({before,ride}));
} finally {
  await browser.close();
}
