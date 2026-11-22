import { chromium } from '/home/joseph/.cache/vetmanage-hu007-qa/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = '/home/joseph/Documentos/Vetmanage/docs/qa/hu007';
const data = JSON.parse(readFileSync(`${root}/logs/fixture-init.json`));
const mode = process.argv[2] || 'first';
const browser = await chromium.launch({channel:'chromium',headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000},locale:'es-EC',timezoneId:'America/Guayaquil'});
const page = await context.newPage();
const results = [];
function fixture(mode) {return JSON.parse(execFileSync('podman',['exec','-i','-e',`QA_MODE=${mode}`,'vet-manage-api-1','node','--input-type=module'],{input:readFileSync(`${root}/fixture.mjs`),encoding:'utf8'}));}
async function snap(id) {await page.screenshot({path:`${root}/evidencias/${id}.png`,fullPage:true});}
async function login(email,password) {
 await page.goto('http://localhost:5174/login');
 await page.locator('#login-email').fill(email);
 await page.locator('#login-password').fill(password);
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await page.waitForURL(u=>!u.pathname.includes('login'));
 await page.goto('http://localhost:5174/appointments/work-schedules');
 await page.getByRole('heading',{name:'Horarios base de atención'}).waitFor();
 await page.getByLabel('Filtrar por veterinario').selectOption(data.vet);
 await page.waitForTimeout(600);
}
async function form(branch,start,end) {
 const dialog = page.getByRole('dialog');
 await dialog.getByLabel('Veterinario').selectOption(data.vet);
 await dialog.getByLabel('Sucursal').selectOption({label:branch});
 await dialog.getByLabel('Día de la semana').selectOption('LUNES');
 await dialog.getByLabel('Hora inicio').selectOption(start);
 await dialog.getByLabel('Hora fin').selectOption(end);
}
async function persist(id) {
 await page.reload();
 await page.getByLabel('Filtrar por veterinario').selectOption(data.vet);
 await page.waitForTimeout(600);
 const rows=page.getByRole('table').locator('tbody tr');
 assert.equal(await rows.count(),1);
 assert.match(await rows.innerText(),/Loja/);
 assert.match(await rows.innerText(),/08:00/);
 assert.match(await rows.innerText(),/12:00/);
 await snap(`${id}-persistencia`);
 const state=fixture('snapshot');
 writeFileSync(`${root}/logs/${id}-persistencia.json`,JSON.stringify(state,null,2));
 assert.equal(state.schedules.length,1);
 assert.equal(state.schedules[0].horaFin,'1970-01-01T12:00:00.000Z');
 return state;
}
try {
 if (mode === 'first') {
  await login('admin@vetmanage.local','Admin12345');
  await page.getByRole('button',{name:'Nuevo horario',exact:true}).first().click();
  await form('Loja','08:00','12:00');
  await page.getByRole('button',{name:'Crear horario',exact:true}).click();
  await page.getByText('Horario creado exitosamente',{exact:true}).waitFor();
  await snap('CP-007-01');
  const state=await persist('CP-007-01');
  assert.equal(state.schedules[0].disponibilidadesDiarias.length,0);
  results.push({id:'CP-007-01',creation:true,persistence:true,slotsVisible:await page.getByText('Turnos base',{exact:false}).count()>0});
  for (const [id,branch,start,end,message] of [
   ['CP-007-02','Loja','12:00','08:00','La hora de fin debe ser posterior a la hora de inicio'],
   ['CP-007-03','Vilcabamba','10:00','13:00','El veterinario ya tiene otro horario asignado en ese mismo intervalo'],
  ]) {
   await page.getByRole('button',{name:'Nuevo horario',exact:true}).first().click();
   await form(branch,start,end);
   await page.getByRole('button',{name:'Crear horario',exact:true}).click();
   await page.getByText(message,{exact:true}).waitFor();
   await snap(id);
   await persist(id);
   results.push({id,passed:true,message});
  }
 } else if (mode === 'four') {
  await login('admin@vetmanage.local','Admin12345');
  const before=fixture('snapshot');
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await form('Loja','08:00','10:00');
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  const message='El cambio afecta citas o disponibilidad diaria existente';
  await page.getByText(message,{exact:true}).waitFor();
  await snap('CP-007-04');
  const after=await persist('CP-007-04');
  assert.deepEqual(after.appointments,before.appointments);
  assert.deepEqual(after.schedules,before.schedules);
  results.push({id:'CP-007-04',passed:true,message});
 } else if (mode === 'five') {
  fixture('grant');
  await login('hu007.recepcion@vetmanage.local','Hu007Prueba2026');
  await page.getByRole('button',{name:'Nuevo horario',exact:true}).first().click();
  await form('Vilcabamba','13:00','14:00');
  fixture('revoke');
  const responsePromise=page.waitForResponse(r=>r.url().endsWith('/scheduling/work-schedules')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Crear horario',exact:true}).click();
  const response=await responsePromise;
  assert.equal(response.status(),403);
  const body=await response.json();
  await page.getByText(body.message,{exact:true}).waitFor();
  await snap('CP-007-05');
  await persist('CP-007-05');
  assert.equal(await page.getByRole('button',{name:'Nuevo horario',exact:true}).count(),0);
  results.push({id:'CP-007-05',passed:body.message==='No tiene permisos para esta acción',status:403,message:body.message,method:'Permiso temporal revocado después de abrir el formulario, antes de guardar. Sesión real de recepcionista.'});
 }
 writeFileSync(`${root}/logs/ui-${mode}.json`,JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
} catch(e) {await snap(`error-${mode}`);console.error(await page.locator('body').innerText());throw e;}
finally {await browser.close();}
