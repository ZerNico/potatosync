import { SwaggerRouter } from 'koa-swagger-decorator';
import { user } from '../controller';
import { auth } from '../middlewares';

const router = new SwaggerRouter();

// USER ROUTES
router.post('/register', user.createUser);
router.post('/login', user.loginUser);
router.get('/verify/:token', user.verify);
router.post('/resend', user.resend)
router.get('/refresh', auth('refresh'), user.refresh);
// JWT PROTECTED USER ROUTES
router.use(auth('jwt'));
router.get('/profile', user.getProfile);


export { router as user };