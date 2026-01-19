try {
  console.log("Resolving @zenstackhq/tanstack-query...");
  const path = require.resolve("@zenstackhq/tanstack-query");
  console.log("Plugin found at:", path);
} catch (error) {
  console.error("Plugin NOT found:", error.message);
}
