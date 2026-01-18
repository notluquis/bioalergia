try {
  console.log('Resolving @zenstackhq/tanstack-query/react...');
  const path = require.resolve('@zenstackhq/tanstack-query/react');
  console.log('Plugin found at:', path);
} catch (error) {
  console.error('Plugin NOT found:', error.message);
}
