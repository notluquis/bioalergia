try {
  console.log('Resolving @zenstackhq/tanstack-query/react...');
  const path = require.resolve('@zenstackhq/tanstack-query/react');
  console.log('Plugin found at:', path);
} catch (e) {
  console.error('Plugin NOT found:', e.message);
}
