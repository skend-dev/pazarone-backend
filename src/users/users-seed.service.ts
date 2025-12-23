import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserType } from './entities/user.entity';

@Injectable()
export class UsersSeedService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async seedAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pazaro.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.ADMIN_NAME || 'Super Admin';

    // Check if admin already exists
    const existingAdmin = await this.usersRepository.findOne({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      if (existingAdmin.userType === UserType.ADMIN) {
        console.log(`✅ Admin user already exists: ${adminEmail}`);
        return existingAdmin;
      } else {
        // Update existing user to admin
        existingAdmin.userType = UserType.ADMIN;
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        existingAdmin.password = hashedPassword;
        existingAdmin.name = adminName;
        const updated = await this.usersRepository.save(existingAdmin);
        console.log(`✅ Updated user to admin: ${adminEmail}`);
        return updated;
      }
    }

    // Create new admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = this.usersRepository.create({
      email: adminEmail,
      name: adminName,
      password: hashedPassword,
      userType: UserType.ADMIN,
    });

    const savedAdmin = await this.usersRepository.save(admin);
    console.log(`✅ Super admin user created successfully!`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   ⚠️  Please change the password after first login!`);

    return savedAdmin;
  }
}
