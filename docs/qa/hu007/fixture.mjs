// Run inside the API container with: node --input-type=module < fixture.mjs
import { PrismaClient } from '/app/dist/generated/prisma/client.js';
import { PrismaPg } from '/app/node_modules/@prisma/adapter-pg/dist/index.mjs';
import { hashPassword } from '/app/dist/common/security/password-hash.js';
const db = new PrismaClient({adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})});
const mode = process.env.QA_MODE || 'init';
const email = 'hu007.veterinario@vetmanage.local';
try {
  if (mode === 'init') {
    for (const [mail, firstName, identification, roleName] of [
      [email, 'Veterinario', '9900000701', 'veterinarian'],
      ['hu007.recepcion@vetmanage.local', 'Recepcionista', '9900000702', 'receptionist'],
    ]) {
      if (await db.person.findUnique({where:{email:mail}})) throw new Error('Fixture already exists: '+mail);
      const role = await db.role.findUniqueOrThrow({where:{name:roleName}});
      await db.user.create({data:{password:await hashPassword('Hu007Prueba2026'), person:{create:{email:mail, firstName, lastName:'Prueba HU007', identification}}, userRoles:{create:{roleId:role.id}}}});
    }
    for (const nombre of ['Loja', 'Vilcabamba']) await db.sucursal.upsert({where:{nombre},update:{},create:{nombre}});
  }
  const vet = await db.user.findFirstOrThrow({where:{person:{email}}});
  const recep = await db.user.findFirstOrThrow({where:{person:{email:'hu007.recepcion@vetmanage.local'}}});
  const schedule = await db.horarioBase.findFirst({where:{veterinarioId:vet.id,estado:true}});
  if (mode === 'protect') {
    if (!schedule) throw new Error('Create schedule through UI first');
    const fecha = new Date('2026-11-23T00:00:00Z');
    await db.disponibilidadDiaria.create({data:{horarioBaseId:schedule.id,fecha,horaInicio:new Date('1970-01-01T08:00:00Z'),horaFin:new Date('1970-01-01T12:00:00Z')}});
    const paciente = await db.patient.findFirstOrThrow();
    const sala = await db.sala.create({data:{nombre:'Consultorio HU007',tipo:'CONSULTORIO',sucursalId:schedule.sucursalId}});
    await db.cita.create({data:{motivo:'CP-007-04 - cita de prueba',fechaHora:new Date('2026-11-23T11:00:00Z'),fechaHoraFin:new Date('2026-11-23T11:30:00Z'),estado:'CONFIRMADA',importeReserva:25,pacienteId:paciente.id,salaId:sala.id,veterinarioId:vet.id,registradaPorId:recep.id}});
  }
  if (mode === 'grant' || mode === 'revoke') {
    const role = await db.role.upsert({where:{name:'hu007-temporary-manage'},update:{},create:{name:'hu007-temporary-manage',displayName:'Permiso temporal QA HU007'}});
    if (mode === 'grant') {
      const permission = await db.permission.findFirstOrThrow({where:{module:'work-schedules',action:'manage'}});
      await db.rolePermission.upsert({where:{roleId_permissionId:{roleId:role.id,permissionId:permission.id}},update:{},create:{roleId:role.id,permissionId:permission.id}});
      await db.userRole.create({data:{userId:recep.id,roleId:role.id}});
    } else await db.userRole.deleteMany({where:{userId:recep.id,roleId:role.id}});
  }
  console.log(JSON.stringify({mode,vet:vet.id,recep:recep.id,branches:await db.sucursal.findMany({where:{nombre:{in:['Loja','Vilcabamba']}}}),schedules:await db.horarioBase.findMany({where:{veterinarioId:vet.id},include:{disponibilidadesDiarias:true}}),appointments:await db.cita.findMany({where:{veterinarioId:vet.id}})},null,2));
} finally {await db.$disconnect();}
