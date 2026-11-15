// AI-assisted code. Licensed under Apache-2.0.
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { initUnified } from './unified';
initUnified().catch(e=>{
  const p=document.createElement('p');p.className='loading';p.textContent=`Could not load the record: ${String(e)}. Please reload to try again.`;document.body.prepend(p);
});
