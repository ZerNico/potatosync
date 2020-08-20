import { CronJob } from 'cron';
import { getManager, LessThan, Repository } from 'typeorm';
import { config } from './config';
import { EmailVerifyToken } from './entity/emailVerifyToken';
import { PasswordResetToken } from './entity/passwordResetToken';
import moment from 'moment';
import { SessionToken } from './entity/sessionToken';


const emailCron = new CronJob(config.cronJobExpression, async () => {
    console.log('Executing cron job once every hour');
    // delete old email verification tokens
    const tokenRepository: Repository<EmailVerifyToken> = getManager().getRepository(EmailVerifyToken);
    const emailToken: EmailVerifyToken[] = await tokenRepository.find({ where: { createdAt: LessThan(moment(new Date()).subtract(12, 'hours')) } });
    await tokenRepository.remove(emailToken);
    console.log(`Deleted ${emailToken.length} verification tokens`);
});

const sessionCron = new CronJob(config.cronJobExpression, async () => {
    console.log('Executing cron job once every hour');
    // delete old session tokens
    const sessionRepository: Repository<SessionToken> = getManager().getRepository(SessionToken);
    const emailToken: EmailVerifyToken[] = await sessionRepository.find({ where: { createdAt: LessThan(moment(new Date()).subtract(12, 'months')) } });
    await sessionRepository.remove(emailToken);
    console.log(`Deleted ${emailToken.length} session tokens`);
});

const passwordCron = new CronJob('* * * * *', async () => {
    console.log('Executing password cron job');
    const tokenRepository: Repository<PasswordResetToken> = getManager().getRepository(PasswordResetToken);
    const passwordToken: PasswordResetToken[] = await tokenRepository.find({ where: { createdAt: LessThan(moment(new Date()).subtract(10, 'minutes'))}});
    await tokenRepository.remove(passwordToken);
    console.log(`Deleted ${passwordToken.length} password-reset tokens`);
});

export { emailCron, passwordCron, sessionCron };