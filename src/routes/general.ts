import { SwaggerRouter } from 'koa-swagger-decorator';
import { general } from '../controller';

const router = new SwaggerRouter();

// GENERAL ROUTES
router.get('/', general.helloWorld);

export { router as general };