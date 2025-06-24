import { PrismaClient } from '../generated/prisma';
import { hashPassword } from '../src/webserver/utils/password';

const prisma = new PrismaClient();

async function resetAdminPassword() {
  try {
    // Check if admin account exists in SystemAccount table
    let admin = await prisma.systemAccount.findUnique({
      where: { username: 'admin' }
    });

    const password = 'admin123';
    const passwordHash = await hashPassword(password);

    if (!admin) {
      // Create admin account if it doesn't exist
      admin = await prisma.systemAccount.create({
        data: {
          username: 'admin',
          passwordHash,
          role: 'admin',
          isActive: true
        }
      });
      console.log('✅ Admin account created successfully');
    } else {
      // Update existing admin password
      admin = await prisma.systemAccount.update({
        where: { username: 'admin' },
        data: { passwordHash }
      });
      console.log('✅ Password reset successfully for user:', admin.username);
    }

    // Clear any existing auth tokens
    await prisma.authToken.deleteMany({
      where: { accountId: admin.id }
    });

    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Role:', admin.role);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();