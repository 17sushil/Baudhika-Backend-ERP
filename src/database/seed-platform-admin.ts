import 'dotenv/config';
import * as argon2 from 'argon2';
import { PlatformUser } from '../platform/entities/platform-user.master.entity';
import masterDs from './master.data-source';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? 'Super Admin';

  if (!email || !password || password.length < 12) {
    console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (at least 12 characters).');
    process.exit(1);
  }

  await masterDs.initialize();
  const repo = masterDs.getRepository(PlatformUser);

  if (await repo.findOne({ where: { email } })) {
    console.log('Platform user already exists. Nothing to do.');
  } else {
    await repo.save(repo.create({ email, name, passwordHash: await argon2.hash(password) }));
    console.log(`Created platform admin ${email}`);
  }
  await masterDs.destroy();
}

main();