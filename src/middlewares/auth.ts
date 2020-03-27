import { BaseContext } from 'koa';
import jwt from 'koa-jwt';
import compose from 'koa-compose';
import { config } from '../config';

const handler = async (ctx: BaseContext, next: () => void) => {
  // return UNAUTHORIZED status code and invalid token error if JWT is not valid
  if (ctx.state.user.type != 'jwt') {
    ctx.throw(401, 'Invalid token');
  }
  await next();
};

export default () => compose([
  // koa-jwt middleware checks token validity and sets decoded JSON object to ctx.state.user
  jwt({ secret: config.jwtSecret }),
  handler
]);