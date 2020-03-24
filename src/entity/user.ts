import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { Length, IsEmail, IsOptional } from 'class-validator';
import { hash, compare } from 'bcrypt';
import { IsUniq } from '@join-com/typeorm-class-validator-is-uniq';

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        length: 80,
        unique: true
    })
    @Length(4, 80)
    @IsUniq()
    username: string;

    @Column({
        length: 100
    })
    @Length(5, 100, {
        groups: ['login']
    })
    password: string;

    @Column({
        length: 100
    })
    password_identifier: string;

    @Column({
        length: 100,
        unique: true
    })
    @Length(10, 100, {
        groups: ['login']
    })
    @IsEmail(undefined, {
        groups: ['login']
    })
    @IsUniq()
    email: string;

    @Column({
        length: 100,
        nullable: true
    })
    @Length(5, 100)
    @IsOptional()
    image_url: string;

    @Column({
        length: 20,
        default: 'user'
    })
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