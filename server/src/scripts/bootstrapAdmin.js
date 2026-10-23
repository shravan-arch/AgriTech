import '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import userStore from '../storage/userStore.js';

const main = async () => {
  const args = process.argv.slice(2);
  const email = args[0] || process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = args[1] || process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin@AgriTech2026!';
  const name = args[2] || 'System Administrator';

  if (!email) {
    console.error('Usage: node src/scripts/bootstrapAdmin.js <email> [password] [name]');
    console.error('Or set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in environment.');
    process.exit(1);
  }

  console.log(`[Bootstrap] Initializing first administrator with email: ${email}...`);

  try {
    await connectDB();

    const activeAdmins = await userStore.countActiveAdmins();
    if (activeAdmins > 0) {
      console.error('[Bootstrap Error] An active administrator already exists in the system. Bootstrap is disabled.');
      await disconnectDB();
      process.exit(1);
    }

    const admin = await userStore.bootstrapFirstAdmin({
      targetEmail: email,
      name,
      password,
      ipAddress: '127.0.0.1 (CLI)',
    });

    console.log(`[Bootstrap Success] Administrator established:`);
    console.log(`  ID:    ${admin._id || admin.id}`);
    console.log(`  Name:  ${admin.name}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role:  ${admin.role}`);
    console.log(`[Bootstrap] Audit record created.`);

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error(`[Bootstrap Error] ${error.message}`);
    await disconnectDB().catch(() => {});
    process.exit(1);
  }
};

main();
