import { SwaggerRouter } from 'koa-swagger-decorator';
import { user } from '../controller';

const router = new SwaggerRouter();

// USER ROUTES
router.post('/register', user.createUser);
router.post('/login', user.loginUser);

export { router as user };