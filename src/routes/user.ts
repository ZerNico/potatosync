import { SwaggerRouter } from 'koa-swagger-decorator';
import { user } from '../controller';
import { auth } from '../middlewares';

const router = new SwaggerRouter();

// USER ROUTES
router.post('/register', user.createUser);
router.post('/login', user.loginUser);
router.get('/verify/:token', user.verify);
router.post('/resend', user.resend);
router.post('/reset-password', user.resetPassword);
router.get('/refresh', auth('refresh'), user.refresh);
router.get('/logout', auth('refresh'), user.logout);
// JWT PROTECTED USER ROUTES
router.get('/profile', auth('jwt'), user.getProfile);


export { router as user };