import {chromium} from 'playwright-core';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
await page.setContent('<canvas id="source" width="400" height="160"></canvas><canvas id="target" width="400" height="160"></canvas>');
await page.addScriptTag({path:process.cwd() + '/node_modules/signature_pad/dist/signature_pad.umd.js'});
const result=await page.evaluate(async()=>{
 const source=document.querySelector('#source');const ctx=source.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,400,160);ctx.strokeStyle='black';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(40,100);ctx.bezierCurveTo(80,10,130,145,190,70);ctx.lineTo(280,95);ctx.stroke();
 const img=source.toDataURL('image/png');window.syntheticSignature=img;
 const canvas=document.querySelector('#target'); const pad=new SignaturePad(canvas,{backgroundColor:'rgb(255,255,255)'});await pad.fromDataURL(img);
 const countDark=()=>{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let dark=0;for(let i=0;i<data.length;i+=4)if(data[i]<100 && data[i+3]>0)dark++;return dark;};
 const before={empty:pad.isEmpty(),vectorCount:pad.toData().length,darkPixels:countDark()};
 // Exact resizeCanvas logic from SignaturePad.tsx 42-49.
 const ratio=Math.max(window.devicePixelRatio||1,1);const data=pad.toData();canvas.width=450*ratio;canvas.height=160*ratio;canvas.getContext('2d').scale(ratio,ratio);pad.clear();pad.fromData(data);
 return {before,after:{empty:pad.isEmpty(),vectorCount:pad.toData().length,darkPixels:countDark()}};
});
fs.writeFileSync('/tmp/quittung-pdf-audit/signature-repro.json',JSON.stringify(result,null,2));
const dataurl=await page.evaluate(()=>window.syntheticSignature);fs.writeFileSync('/tmp/quittung-pdf-audit/signature.png',Buffer.from(dataurl.split(',')[1],'base64'));
console.log(JSON.stringify(result));await browser.close();
