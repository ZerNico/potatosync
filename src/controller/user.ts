import { BaseContext } from 'koa';
import { getManager, Repository } from 'typeorm';
import { validate, ValidationError } from 'class-validator';
import { body, request, responsesAll, summary, tagsAll } from 'koa-swagger-decorator';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import { User, userSchema, loginSchema } from '../entity/user';
import { config } from '../config';

@tagsAll(['User'])
@responsesAll({ 200: { description: 'success'}, 400: { description: 'bad request'}})
export default class UserController {
  @request('post', '/user/register')
  @summary(`Register a user`)
  @body(userSchema)
  public static async createUser(ctx: BaseContext) {

    // get a user repository to perform operations with user
    const userRepository: Repository<User> = getManager().getRepository(User);

    // build up user entity to be saved
    const userToBeSaved: User = new User();
    userToBeSaved.username = ctx.request.body.username;
    userToBeSaved.email = ctx.request.body.email;
    userToBeSaved.password = ctx.request.body.password;

    // identifier to detect password change
    userToBeSaved.password_identifier = crypto.randomBytes(5).toString('hex');

    // validate user entity
    const errors: ValidationError[] = await validate(userToBeSaved, { validationError: { target: false } }); // errors is an array of validation errors

    if (errors.length > 0) {
      // return BAD REQUEST status code and errors array
      ctx.status = 400;
      ctx.body = errors;
    } else {
      // hash password
      await userToBeSaved.hashPassword();
      // save the user contained in the POST body
      const user = await userRepository.save(userToBeSaved);
      // dont return password
      delete user.password;
      delete user.password_identifier;
      // return CREATED status code and updated user
      ctx.status = 201;
      ctx.body = user;
    }
  }

  @request('post', '/user/login')
  @summary(`Register a user`)
  @body(loginSchema)
  public static async loginUser(ctx: BaseContext) {

    // get a user repository to perform operations with user
    const userRepository: Repository<User> = getManager().getRepository(User);

    // build up user entity
    const userToBeLoggedIn: User = new User();
    userToBeLoggedIn.email = ctx.request.body.email;
    userToBeLoggedIn.password = ctx.request.body.password;

    // validate user entity
    const errors: ValidationError[] = await validate(userToBeLoggedIn, { groups: ['login'], validationError: { target: false } }); // errors is an array of validation errors

    // try to find user
    const user: User = await userRepository.findOne({ email: userToBeLoggedIn.email });

    if (errors.length > 0) {
      // return BAD REQUEST status code and errors array
      ctx.status = 400;
      ctx.body = errors;
    } else if (!user) {
      // return BAD REQUEST status code and email does not exist error
      ctx.status = 400;
      ctx.body = 'The specified email is invalid';
    } else if (!await user.compareHash(userToBeLoggedIn.password)) {
      // return BAD REQUEST status code and password is wrong error
      ctx.status = 400;
      ctx.body = 'The specified password is invalid';
    } else {
      // create jwt and refresh token
      const token = jwt.sign(
        { sub: user.id, role: user.role, type: 'jwt' },
        config.jwtSecret,
        { expiresIn: '20m' }
      );
      const refresh_token = jwt.sign(
        { sub: user.id, pwId: user.password_identifier, type: 'refresh' },
        config.jwtSecret,
        { expiresIn: '1y' }
      );
      // return OK status code and tokens
      ctx.status = 200;
      ctx.body = { token: token, refresh_token: refresh_token };
    }
  }

  @request('get', '/user/me')
  @summary(`Register a user`)
  public static async getMe(ctx: BaseContext) {

    // get a user repository to perform operations with user
    const userRepository: Repository<User> = getManager().getRepository(User);

    // try to find user
    const user: User = await userRepository.findOne({ id: ctx.state.user.sub });

    if (!user) {
      // return BAD REQUEST status code and user does not exist error
      ctx.status = 400;
      ctx.body = 'The specified user was not found';
    } else {
      // dont return password
      delete user.password;
      delete user.password_identifier;
      // return OK status code and user object
      ctx.status = 200;
      ctx.body = user;
    }
  }
}
