import { Column, DataSource, Entity, JoinTable, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAProject } from './DRAProject.js';
import { DRADataSource } from './DRADataSource.js';
import { DRADataModel } from './DRADataModel.js';
import { DRAVerificationCode } from './DRAVerificationCode.js';
import { DRADashboard } from './DRADashboard.js';
import { DRAAIDataModelConversation } from './DRAAIDataModelConversation.js';
import { EUserType } from '../types/EUserType.js';
import { DRAArticle } from './DRAArticle.js';
import { DRACategory } from './DRACategory.js';
import { DRAArticleCategory } from './DRAArticleCategory.js';
import { DRADataModelSource } from './DRADataModelSource.js';
import { DRATableMetadata } from './DRATableMetadata.js';

@Entity('dra_users_platform')
export class DRAUsersPlatform {
    @PrimaryGeneratedColumn()
    id!: number
    @Column({ type: 'varchar', length: 320 })
    email!: string
    @Column({ type: 'varchar', length: 255 })
    first_name!: string
    @Column({ type: 'varchar', length: 255 })
    last_name!: string
    @Column({ type: 'varchar', length: 255 })
    password!: string
    @Column({ type: 'enum', enum: [EUserType.ADMIN, EUserType.NORMAL] })
    user_type!: EUserType;
    @Column({ type: 'timestamp', nullable: true })
    email_verified_at!: Date
    @Column({ type: 'timestamp', nullable: true })
    unsubscribe_from_emails_at!: Date
    
    @OneToMany(() => DRAProject, (project) => project.users_platform, { cascade: ["remove", "update"] })
    projects!: Relation<DRAProject>[]
    
    @OneToMany(() => DRADataSource, (dataSource) => dataSource.users_platform, { cascade: ["remove", "update"] })
    data_sources!: Relation<DRADataSource>[]
    
    @OneToMany(() => DRADataModel, (dataModel) => dataModel.users_platform, { cascade: ["remove", "update"] })
    data_models!: Relation<DRADataModel>[]
    
    @OneToMany(() => DRAVerificationCode, (verificationCodes) => verificationCodes.users_platform, { cascade: ["remove", "update"] })
    verification_codes!: Relation<DRAVerificationCode>[]
    
    @OneToMany(() => DRADashboard, (dashboards) => dashboards.users_platform, { cascade: ["remove", "update"] })
    dashboards!: Relation<DRADashboard>[]

    @OneToMany(() => DRAArticle, (articles) => articles.users_platform, { cascade: ["remove", "update"] })
    articles!: Relation<DRAArticle>[]

    @OneToMany(() => DRACategory, (categories) => categories.users_platform, { cascade: ["remove", "update"] })
    categories!: Relation<DRACategory>[]

    @OneToMany(() => DRAArticleCategory, (articleCategory) => articleCategory.users_platform, { cascade: ["remove", "update"] })
    articles_categories!: Relation<DRAArticleCategory>[]

    @OneToMany(() => DRAAIDataModelConversation, (conversation) => conversation.user)
    ai_conversations!: Relation<DRAAIDataModelConversation>[];

    @OneToMany(() => DRADataModelSource, (dataModelSource) => dataModelSource.users_platform, { cascade: ["remove", "update"] })
    data_model_sources!: Relation<DRADataModelSource>[];

    @OneToMany(() => DRATableMetadata, (tableMetadata) => tableMetadata.users_platform, { cascade: ["remove", "update"] })
    table_metadata!: Relation<DRATableMetadata>[];
}