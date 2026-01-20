
import { db } from '../packages/db/src/client';

async function main() {
  console.log('--- Searching for "Nora" ---');
  const nora = await db.person.findMany({
    where: {
      OR: [
        { names: { contains: 'Nora', mode: 'insensitive' } },
        { fatherName: { contains: 'Nora', mode: 'insensitive' } },
        { motherName: { contains: 'Nora', mode: 'insensitive' } }
      ]
    },
    include: {
      employee: true,
      user: true
    }
  });
  console.log(JSON.stringify(nora, null, 2));

  console.log('\n--- All Active Employees ---');
  const employees = await db.employee.findMany({
    where: { status: 'ACTIVE' },
    include: {
        person: true
    }
  });
  console.log(`Found ${employees.length} active employees.`);
  employees.forEach(e => {
      console.log(`${e.id}: ${e.person.names} ${e.person.fatherName} - ${e.position}`);
  });
}

main()
  .catch((e) => console.error(e));
