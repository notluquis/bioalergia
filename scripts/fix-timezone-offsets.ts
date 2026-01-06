import { db } from '../packages/db/src/client.js';

async function main() {
  console.log('🔄 Iniciando migración de timezone offsets (sumando 6 horas)...');
  
  // Ajustar start_time sumando 6 horas
  const startResult = await db.$executeRaw`
    UPDATE employee_timesheets
    SET start_time = (start_time::time + interval '6 hours')::time
    WHERE start_time IS NOT NULL
  `;
  console.log(`✅ start_time ajustado: ${startResult} registros`);
  
  // Ajustar end_time sumando 6 horas
  const endResult = await db.$executeRaw`
    UPDATE employee_timesheets
    SET end_time = (end_time::time + interval '6 hours')::time
    WHERE end_time IS NOT NULL
  `;
  console.log(`✅ end_time ajustado: ${endResult} registros`);
  
  // Verificar los cambios
  const sample = await db.$queryRaw`
    SELECT 
      work_date,
      start_time,
      end_time,
      worked_minutes
    FROM employee_timesheets
    ORDER BY work_date DESC
    LIMIT 10
  `;
  
  console.log('\n📊 Muestra de registros actualizados:');
  console.table(sample);
  
  console.log('\n✨ Migración completada exitosamente');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
