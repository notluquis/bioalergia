try {
  console.log('Resolving @zenstackhq/tanstack-query...');
  const path = require.resolve('@zenstackhq/tanstack-query');
  console.log('Plugin found at:', path);
} catch (e) {
  console.error('Plugin NOT found:', e.message);
}
