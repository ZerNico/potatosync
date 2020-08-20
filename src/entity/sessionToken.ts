import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user';

@Entity()
export class SessionToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @OneToOne(type => User, User => User.verify_token, {
        cascade: true,
        onDelete: 'CASCADE'
    })
    @JoinColumn()
    user: User;

    @Column({ length: 100 })
    token: string;

    @CreateDateColumn()
    createdAt: string;
}