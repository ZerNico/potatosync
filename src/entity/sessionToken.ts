import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user';

@Entity()
export class SessionToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(type => User, User => User.verify_token, {
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