import { db } from '../packages/db/src/client.js';

async function main() {
  console.log('🔍 Buscando registros con tiempos NULL...\n');
  
  const nullTimes = await db.$queryRaw`
    SELECT 
      id,
      employee_id,
      work_date,
      start_time,
      end_time,
      worked_minutes,
      overtime_minutes
    FROM employee_timesheets
    WHERE (start_time IS NULL OR end_time IS NULL)
      AND worked_minutes > 0
    ORDER BY work_date DESC
  `;
  
  console.log(`📊 Registros encontrados: ${(nullTimes as any[]).length}\n`);
  console.table(nullTimes);
  
  // Calcular start/end aproximados basados en worked_minutes
  console.log('\n💡 Sugerencias de tiempos basados en worked_minutes:');
  
  for (const record of nullTimes as any[]) {
    const hours = Math.floor(record.worked_minutes / 60);
    const minutes = record.worked_minutes % 60;
    
    // Asumir entrada a las 09:00 y calcular salida
    const startHour = 9;
    const endMinutes = startHour * 60 + record.worked_minutes;
    const endHour = Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;
    
    console.log(`\nID ${record.id} (${record.work_date.toISOString().split('T')[0]}):`);
    console.log(`  Trabajadas: ${hours}h ${minutes}m (${record.worked_minutes} min)`);
    console.log(`  Sugerencia: 09:00 → ${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
