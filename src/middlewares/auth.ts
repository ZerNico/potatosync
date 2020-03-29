import { BaseContext } from 'koa';
import jwt from 'koa-jwt';
import compose from 'koa-compose';
import { config } from '../config';

function middleware(type: String) {
  // return UNAUTHORIZED status code and invalid token error if JWT isn't right type
  return async function (ctx: BaseContext, next: () => void) {
    if (ctx.state.user.type != type) {
      ctx.throw(401, 'Token is not of type ' + type);
    }
    await next();
  };
}

export default (type: String) => compose([
  // koa-jwt middleware checks token validity and sets decoded JSON object to ctx.state.user
  jwt({ secret: config.jwtSecret }),
  middleware(type)
]);