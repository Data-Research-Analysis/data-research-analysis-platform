import { Column, DataSource, Entity, JoinTable, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DRAProject } from './DRAProject';
import { DRADataSource } from './DRADataSource';
import { DRADataModel } from './DRADataModel';
import { DRAVerificationCode } from './DRAVerificationCode';
import { DRADashboard } from './DRADashboard';
import { EUserType } from '../types/EUserType';
import { DRAArticle } from './DRAArticle';
import { DRACategory } from './DRACategory';
import { DRAArticleCategory } from './DRAArticleCategory';

@Entity('dra_users_platform')
export class DRAUsersPlatform {
    @PrimaryGeneratedColumn()
    id: number
    @Column({ type: 'varchar', length: 255 })
    email: string
    @Column({ type: 'varchar', length: 255 })
    first_name: string
    @Column({ type: 'varchar', length: 255 })
    last_name: string
    @Column({ type: 'varchar', length: 255 })
    password: string
    @Column({ type: 'enum', enum: [EUserType.ADMIN, EUserType.NORMAL] })
    user_type: EUserType;
    @Column({ type: 'timestamp', nullable: true })
    email_verified_at: Date
    @Column({ type: 'timestamp', nullable: true })
    unsubscribe_from_emails_at: Date
    
    @OneToMany(() => DRAProject, (project) => project.users_platform, { cascade: ["remove", "update"] })
    projects!: DRAProject[]
    
    @OneToMany(() => DRADataSource, (dataSource) => dataSource.users_platform, { cascade: ["remove", "update"] })
    data_sources!: DRADataSource[]
    
    @OneToMany(() => DRADataModel, (dataModel) => dataModel.users_platform, { cascade: ["remove", "update"] })
    data_models!: DRADataModel[]
    
    @OneToMany(() => DRAVerificationCode, (verificationCodes) => verificationCodes.users_platform, { cascade: ["remove", "update"] })
    verification_codes!: DRAVerificationCode[]
    
    @OneToMany(() => DRADashboard, (dashboards) => dashboards.users_platform, { cascade: ["remove", "update"] })
    dashboards!: DRADashboard[]

    @OneToMany(() => DRAArticle, (articles) => articles.users_platform, { cascade: ["remove", "update"] })
    articles!: DRAArticle[]

    @OneToMany(() => DRACategory, (categories) => categories.users_platform, { cascade: ["remove", "update"] })
    categories!: DRACategory[]

    @OneToMany(() => DRAArticleCategory, (articleCategory) => articleCategory.users_platform, { cascade: ["remove", "update"] })
    articles_categories!: DRAArticleCategory[]


}