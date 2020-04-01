import { BaseContext } from 'koa';
import { getManager, Repository } from 'typeorm';
import { validate, ValidationError } from 'class-validator';
import { body, request, responsesAll, summary, tagsAll, path } from 'koa-swagger-decorator';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import { User, userSchema, loginSchema } from '../entity/user';
import { Token } from '../entity/token';
import { config } from '../config';
import { email } from '../email';


@tagsAll(['User'])
@responsesAll({ 200: { description: 'success'}, 400: { description: 'bad request'}})
export default class UserController {
  @request('post', '/user/register')
  @summary(`Register a user`)
  @body(userSchema)
  public static async createUser(ctx: BaseContext) {

    // get a user repository to perform operations with user
    const userRepository: Repository<User> = getManager().getRepository(User);
    const tokenRepository: Repository<Token> = getManager().getRepository(Token);

    // build up user entity to be saved
    const userToBeSaved: User = new User();
    userToBeSaved.username = ctx.request.body.username;
    userToBeSaved.email = ctx.request.body.email;
    userToBeSaved.password = ctx.request.body.password;

    // identifier to detect password change
    userToBeSaved.password_identifier = crypto.randomBytes(5).toString('hex');

    // validate user entity
    const errors: ValidationError[] = await validate(userToBeSaved, {
      groups: ['register'], validationError: { target: false }
    }); // errors is an array of validation errors

    if (errors.length > 0) {
      // return BAD REQUEST status code and errors array
      ctx.status = 400;
      ctx.body = errors;
    } else {
      // hash password
      await userToBeSaved.hashPassword();
      // generate verification token
      const tokenToBeSaved: Token = new Token();
      tokenToBeSaved.token = crypto.randomBytes(3).toString('hex');
      // send verification mail
      try {
        await email.send({
          template: 'register',
          message: {
            to: userToBeSaved.email
          },
          locals: {
            uname: userToBeSaved.username,
            token: tokenToBeSaved.token,
            burl: config.baseUrl
          }
        });
      } catch (err) {
        ctx.throw(500, 'Could not send E-Mail');
      }
      // save user and token
      const user = await userRepository.save(userToBeSaved);
      tokenToBeSaved.user = user;
      const token = await tokenRepository.save(tokenToBeSaved);
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
    userToBeLoggedIn.username = ctx.request.body.username;
    userToBeLoggedIn.password = ctx.request.body.password;


    // validate user entity
    const errors: ValidationError[] = await validate(userToBeLoggedIn, {
      groups: ['login'], validationError: { target: false }
    }); // errors is an array of validation errors

    // try to find user
    const user: User = await userRepository.findOne({
      where: [
        { email: userToBeLoggedIn.email },
        { username: userToBeLoggedIn.username }
      ]
    });

    if (errors.length > 0) {
      // return BAD REQUEST status code and errors array
      ctx.status = 400;
      ctx.body = errors;
    } else if (!user) {
      // return BAD REQUEST status code and email/password does not exist error
      ctx.status = 400;
      ctx.body = 'The specified email/password is invalid';
    } else if (!await user.compareHash(userToBeLoggedIn.password)) {
      // return BAD REQUEST status code and password is wrong error
      ctx.status = 400;
      ctx.body = 'The specified password is invalid';
    } else if (!user.verified) {
      // return UNAUTHORIZED status code and account is not verified error
      ctx.status = 401;
      ctx.body = 'The specified account is not verified';
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

  @request('get', '/user/profile')
  @summary(`Get a user profile`)
  public static async getProfile(ctx: BaseContext) {

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

  @request('get', '/user/refresh')
  @summary(`Get a new jwt token`)
  public static async refresh(ctx: BaseContext) {

    // get a user repository to perform operations with user
    const userRepository: Repository<User> = getManager().getRepository(User);

    // try to find user
    const user: User = await userRepository.findOne({ id: ctx.state.user.sub });

    if (!user) {
      // return BAD REQUEST status code and user does not exist error
      ctx.status = 400;
      ctx.body = 'The specified user was not found';
    } else if (ctx.state.user.pwId != user.password_identifier) {
      // return UNAUTHORIZED status code and invalid token error
      ctx.status = 401;
      ctx.body = 'Invalid token';
    } else if (!user.verified) {
      // return UNAUTHORIZED status code and account is not verified error
      ctx.status = 401;
      ctx.body = 'The specified account is not verified';
    } else {
      // create jwt
      const token = jwt.sign(
        { sub: user.id, role: user.role, type: 'jwt' },
        config.jwtSecret,
        { expiresIn: '20m' }
      );
      // return OK status code and jwt token
      ctx.status = 200;
      ctx.body = { token: token };
    }
  }

  @request('get', '/user/verify/{token}')
  @summary(`Verify E-Mail`)
  @path({
    token: { type: 'string', required: true, description: 'verification token' }
  })
  public static async verify(ctx: BaseContext) {

    // get a user repository to perform operations with user
    const tokenRepository: Repository<Token> = getManager().getRepository(Token);

    // try to find user
    const token: Token = await tokenRepository.findOne({ token: ctx.params.token }, { relations: ['user'] });

    if (!token) {
      // return BAD REQUEST status code and user does not exist error
      ctx.status = 400;
      ctx.body = 'The specified token was not found';
    } else {
      // set verified status to true
      token.user.verified = true;
      await tokenRepository.save(token);
      // delete token
      await tokenRepository.remove(token);
      // return OK status code and jwt token
      ctx.status = 200;
      ctx.body = 'Account verified';
    }
  }
}

