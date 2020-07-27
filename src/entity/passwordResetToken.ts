import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user';


@Entity()
export class PasswordResetToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @OneToOne(type => User, User => User.reset_token, {
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