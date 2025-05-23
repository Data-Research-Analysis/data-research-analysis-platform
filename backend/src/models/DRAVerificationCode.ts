import { Column, Entity, JoinTable, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
@Entity('dra_verification_codes')
export class DRAVerificationCode {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ type: 'varchar', length: 1024 })
  code: string;
  @Column({ type: 'timestamp', nullable: true })
  expired_at: Date;

  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.verification_codes)
  @JoinTable()
  users_platform: DRAUsersPlatform
}