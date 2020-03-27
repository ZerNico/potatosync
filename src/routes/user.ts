import { SwaggerRouter } from 'koa-swagger-decorator';
import { user } from '../controller';
import { auth } from '../middlewares';

const router = new SwaggerRouter();

// USER ROUTES
router.post('/register', user.createUser);
router.post('/login', user.loginUser);
// JWT PROTECTED USER ROUTES
router.use(auth());
router.get('/me', user.getMe)

export { router as user };