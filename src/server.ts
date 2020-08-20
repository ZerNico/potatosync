import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';
import cors from '@koa/cors';
import winston from 'winston';
import { createConnection } from 'typeorm';
import 'reflect-metadata';
import * as PostgressConnectionStringParser from 'pg-connection-string';

import { logger } from './logging';
import { config } from './config';
import { router } from './routes';
import { emailCron, passwordCron, sessionCron } from './cron';

// Get DB connection options from env variable
const connectionOptions = PostgressConnectionStringParser.parse(config.databaseUrl);
// create connection with database
// note that its not active database connection
// TypeORM creates you connection pull to uses connections from pull on your requests
createConnection({
    type: 'postgres',
    host: connectionOptions.host,
    port: Number(connectionOptions.port),
    username: connectionOptions.user,
    password: connectionOptions.password,
    database: connectionOptions.database,
    synchronize: true,
    logging: false,
    entities: config.dbEntitiesPath,
    extra: {
        ssl: connectionOptions.ssl === undefined ? true : connectionOptions.ssl == 'true', // Defaults to true when it isn't set in connection string
    }
}).then(async _connection => {
    const app = new Koa();

    // Provides important security headers to make your app more secure
    app.use(helmet());

    // Enable cors with default options
    app.use(cors());

    // Logger middleware -> use winston as logger (logging.ts with config)
    app.use(logger(winston));

    // Enable bodyParser with default options
    app.use(bodyParser());

    // Register routes
    app.use(router.routes()).use(router.allowedMethods());

    // Register cron jobs to do any action needed
    emailCron.start();
    passwordCron.start();
    sessionCron.start();

    app.listen(config.port);

    console.log(`Server running on port ${config.port}`);

}).catch(error => console.log('TypeORM connection error: ', error));