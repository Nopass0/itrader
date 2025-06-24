import { PrismaClient } from '../generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetAdminPassword() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const user = await prisma.webServerUser.update({
      where: { username: 'admin' },
      data: { password: hashedPassword }
    });
    
    console.log('✅ Password reset successfully for user:', user.username);
    console.log('New password: admin123');
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();