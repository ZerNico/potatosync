import { CronJob } from 'cron';
import { getManager, LessThan, Repository } from 'typeorm';
import { subHours } from 'date-fns';
import { config } from './config';
import { Token } from './entity/token';


const cron = new CronJob(config.cronJobExpression, async () => {
    console.log('Executing cron job once every hour');
    // delete old verification tokens
    const tokenRepository: Repository<Token> = getManager().getRepository(Token);
    const token: Token[] = await tokenRepository.find({ where: { createdAt: LessThan(subHours(new Date(), 12)) } });
    await tokenRepository.remove(token);
});

export { cron };