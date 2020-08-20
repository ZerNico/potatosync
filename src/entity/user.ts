import { Entity, Column, PrimaryGeneratedColumn, OneToOne } from 'typeorm';
import { Length, IsEmail, IsOptional, ValidateIf } from 'class-validator';
import { hash, compare } from 'bcrypt';
import { IsUniq } from '@join-com/typeorm-class-validator-is-uniq';
import { EmailVerifyToken } from './emailVerifyToken';
import { PasswordResetToken } from './passwordResetToken';

@Entity()
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 80, unique: true })
    @Length(3, 80, { groups: ['register', 'login', 'send-reset'] })
    @IsUniq({ groups: ['register'] })
    @ValidateIf(o => o.email == undefined, { groups: ['login', 'send-reset'] })
    username: string;

    @Column({ length: 100 })
    @Length(5, 60, { groups: ['register', 'login'] })
    password: string;

    @Column({ length: 100 })
    password_identifier: string;

    @Column({ length: 100, unique: true })
    @Length(10, 100, { groups: ['register', 'login', 'resend', 'send-reset'] })
    @IsEmail(undefined, { groups: ['register', 'login', 'resend', 'send-reset'] })
    @IsUniq({ groups: ['register'] })
    @IsOptional({ groups: ['login', 'send-reset'] })
    email: string;

    @Column({ length: 100, nullable: true })
    @Length(5, 100)
    @IsOptional()
    image_url: string;

    @OneToOne(type => EmailVerifyToken, EmailVerifyToken => EmailVerifyToken.user)
    verify_token: EmailVerifyToken;

    @OneToOne(type => PasswordResetToken, PasswordResetToken => PasswordResetToken.user)
    reset_token: PasswordResetToken;

    @Column({ default: false })
    @IsOptional()
    verified: boolean;

    @Column({ length: 20, default: 'user' })
    @Length(2, 20)
    @IsOptional()
    role: string;

    async hashPassword() {
        this.password = await hash(this.password, 10);
    }

    async compareHash(password) {
        return await compare(password, this.password);
    }
}

export const userSchema = {
    username: { type: 'string', required: true, example: 'Potato' },
    password: { type: 'string', required: true, example: 's3cur3passw0rd' },
    email: { type: 'string', required: true, example: 'potato@gmail.com' }
};
export const loginSchema = {
    password: { type: 'string', required: true, example: 's3cur3passw0rd' },
    email: { type: 'string', required: true, example: 'potato@gmail.com' }
};