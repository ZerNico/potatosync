import { SwaggerRouter } from 'koa-swagger-decorator';
import path from 'path';

import { user } from './user';
import { general } from './general';

const router = new SwaggerRouter();

// include all routes
router.use('/user', user.routes()).use(user.allowedMethods());
router.use('/user', general.routes()).use(general.allowedMethods());

// Swagger endpoint
router.swagger({
  title: 'PotatoSync',
  description: 'PotatoSync REST API',
  version: '2.0.0'
});

// mapDir will scan the input dir, and automatically call router.map to all Router Class
router.mapDir(path.join(__dirname, '../'));

export { router };