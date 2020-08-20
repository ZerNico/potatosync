import { BaseContext } from 'koa';
import { getManager, Repository } from 'typeorm';
import { validate, ValidationError } from 'class-validator';
import { body, request, responsesAll, summary, tagsAll, path } from 'koa-swagger-decorator';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pug from 'pug';

import { User, userSchema, loginSchema } from '../entity/user';
import { EmailVerifyToken } from '../entity/emailVerifyToken';
import { config } from '../config';
import { email } from '../email';
import { PasswordResetToken } from '../entity/passwordResetToken';
import { formData } from 'koa-swagger-decorator/dist';
import moment from 'moment';
import { SessionToken } from '../entity/sessionToken';


@tagsAll(['User'])
@responsesAll({ 200: { description: 'success'}, 400: { description: 'bad request'}})
export default class UserController {
  @request('post', '/user/register')
  @summary(`Register a user`)
  @body(userSchema)
  public static async createUser(ctx: BaseContext) {

    // get a user repository to perform operations with user
    const userRepository: Repository<User> = getManager().getRepository(User);
    const tokenRepository: Repository<EmailVerifyToken> = getManager().getRepository(EmailVerifyToken);

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
      const tokenToBeSaved: EmailVerifyToken = new EmailVerifyToken();
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
        ctx.throw(500, 'Could not send email');
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
    const sessionRepository: Repository<SessionToken> = getManager().getRepository(SessionToken);

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
      // build up session token entity
      const tokenToBeSaved: EmailVerifyToken = new EmailVerifyToken();
      tokenToBeSaved.token = crypto.randomBytes(3).toString('hex');
      tokenToBeSaved.user = user;
      await sessionRepository.save(tokenToBeSaved);
      // create jwt and refresh token
      const token = jwt.sign(
        { sub: user.id, role: user.role, type: 'jwt' },
        config.jwtSecret,
        { expiresIn: '20m' }
      );
      const refresh_token = jwt.sign(
        { sub: user.id, session: tokenToBeSaved.token, pwId: user.password_identifier, type: 'refresh' },
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
    const sessionRepository: Repository<SessionToken> = getManager().getRepository(SessionToken);

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
    }

    // try to find user
    const token: EmailVerifyToken = await sessionRepository.findOne({ token: ctx.state.user.session }, { relations: ['user'] });

    if (!token || user.id != token.user.id) {
      // return BAD REQUEST status code and invalid session error
      ctx.status = 400;
      ctx.body = 'Invalid session';
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
    const tokenRepository: Repository<EmailVerifyToken> = getManager().getRepository(EmailVerifyToken);

    // try to find user
    const token: EmailVerifyToken = await tokenRepository.findOne({ token: ctx.params.token }, { relations: ['user'] });

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

  @request('post', '/user/resend')
  @summary(`Resend verification E-Mail`)
  public static async resend(ctx: BaseContext) {

    // get a user and token repository to perform operations with it
    const userRepository: Repository<User> = getManager().getRepository(User);
    const tokenRepository: Repository<EmailVerifyToken> = getManager().getRepository(EmailVerifyToken);

    // build up user entity to be saved
    const userToBeVerified: User = new User();
    userToBeVerified.email = ctx.request.body.email;

    // validate user entity
    const errors: ValidationError[] = await validate(userToBeVerified, {
      groups: ['resend'], validationError: { target: false }
    }); // errors is an array of validation errors

    // try to find user
    const user: User = await userRepository.findOne({ email: userToBeVerified.email }, { relations: ['verify_token'] });

    if (errors.length > 0) {
      // return BAD REQUEST status code and errors array
      ctx.status = 400;
      ctx.body = errors;
    } else if (!user) {
      // return BAD REQUEST status code and email does not exist error
      ctx.status = 400;
      ctx.body = 'The specified email was not found';
    } else if (user.verified) {
      // return BAD REQUEST status code and user already verified error
      ctx.status = 400;
      ctx.body = 'The specified user is already verified';
    } else {
      if (!user.verify_token) {
        // generate verification token
        const tokenToBeSaved: EmailVerifyToken = new EmailVerifyToken();
        tokenToBeSaved.token = crypto.randomBytes(3).toString('hex');
        tokenToBeSaved.user = user;
        // send verification mail
        try {
          await email.send({
            template: 'register',
            message: {
              to: user.email
            },
            locals: {
              uname: user.username,
              token: tokenToBeSaved.token,
              burl: config.baseUrl
            }
          });
        } catch (err) {
          ctx.throw(500, 'Could not send email');
        }
        // save verification token
        await tokenRepository.save(tokenToBeSaved);
        // return OK status code
        ctx.status = 200;
        ctx.body = 'Email has been sent';
      } else {
        // send verification mail
        try {
          await email.send({
            template: 'register',
            message: {
              to: user.email
            },
            locals: {
              uname: user.username,
              token: user.verify_token.token,
              burl: config.baseUrl
            }
          });
        } catch (err) {
          ctx.throw(500, 'Could not send email');
        }
        // return OK status code
        ctx.status = 200;
        ctx.body = 'Email has been sent';
      }
    }
  }

  @request('post', '/user/send-password-reset')
  @summary('Send password reset mail')
  public static async sendResend(ctx: BaseContext) {
    // get a user and token repository to perform operations with it
    const userRepository: Repository<User> = getManager().getRepository(User);
    const tokenRepository: Repository<PasswordResetToken> = getManager().getRepository(PasswordResetToken);

    // build up user entity
    const userToSendPasswordTo: User = new User();
    userToSendPasswordTo.email = ctx.request.body.email;
    userToSendPasswordTo.username = ctx.request.body.username;

    // validate user entity
    const errors: ValidationError[] = await validate(userToSendPasswordTo, {
      groups: ['send-reset'], validationError: { target: false }
    }); // errors is an array of validation errors

    // try to find user
    const user: User = await userRepository.findOne({
      where: [
        { email: userToSendPasswordTo.email },
        { username: userToSendPasswordTo.username }
      ]
    });

    if (errors.length > 0) {
      // return BAD REQUEST status code and errors array
      ctx.status = 400;
      ctx.body = errors;
    } else if (!user) {
      // return BAD REQUEST status code and email does not exist error
      ctx.status = 400;
      ctx.body = 'The specified user was not found';
    } else if (!user.verified) {
      // return BAD REQUEST status code and user already verified error
      ctx.status = 400;
      ctx.body = 'The specified user is not verified';
    } else {
      if (!user.reset_token) {
        // generate verification token
        const tokenToBeSaved: PasswordResetToken = new PasswordResetToken();
        tokenToBeSaved.token = crypto.randomBytes(6).toString('hex');
        tokenToBeSaved.user = user;
        // send verification mail
        try {
          await email.send({
            template: 'password-reset',
            message: {
              to: user.email
            },
            locals: {
              uname: user.username,
              token: tokenToBeSaved.token,
              burl: config.baseUrl,
              expire_min: 10,
            }
          });
        } catch (err) {
          console.log(err);
          ctx.throw(500, 'Could not send email');
        }
        // save verification token
        await tokenRepository.save(tokenToBeSaved);
        // return OK status code
        ctx.status = 200;
        ctx.body = 'Email has been sent';
      } else {
        // send verification mail
        try {
          await email.send({
            template: 'password-reset',
            message: {
              to: user.email
            },
            locals: {
              uname: user.username,
              token: user.reset_token.token,
              burl: config.baseUrl
            }
          });
        } catch (err) {
          console.log(err);
          ctx.throw(500, 'Could not send email');
        }
        // return OK status code
        ctx.status = 200;
        ctx.body = 'Email has been sent';
      }
    }
  }

  @request('get', '/user/reset-password/{token}')
  @summary('Show password form when using link from email')
  @path({
    token: { type: 'string', required: true, description: 'Reset token' }
  })
  public static async showPasswordForm(ctx: BaseContext) {
    const compiledPasswordPage = pug.compileFile('pages/password-reset.pug');
    ctx.status = 200;
    ctx.body = compiledPasswordPage({
      token: ctx.params.token,
      min_password_length: 5,
      max_password_length: 60,
    });
  }

  @request('post', '/user/reset-password')
  @summary('Show password form when using link from email')
  @formData({
    password: {type: 'string', required: true, description: 'New Password'},
    password_again: {type: 'string', required: true, description: 'New Password Again'},
    token: {type: 'string', required: true, description: 'Reset token'}
  })
  public static async resetPassword(ctx: BaseContext) {
    const compiledPasswordPage = pug.compileFile('pages/password-reset.pug');
    // get a user repository to perform operations with user
    const tokenRepository: Repository<PasswordResetToken> = getManager().getRepository(PasswordResetToken);
    // try to find user
    const token: PasswordResetToken = await tokenRepository.findOne({token: ctx.request.body.token }, { relations: ['user'] });
    if (!token) {
      // return BAD REQUEST status code and user does not exist error
      ctx.status = 400;
      ctx.body = 'The token has expired';
    } else if (moment(token.createdAt).add(10, 'minutes').unix() > moment.now()) {
      await tokenRepository.remove(token);
      ctx.status = 400;
      ctx.body = 'The token has expired';
    } else if (ctx.request.body.password !== ctx.request.body.password_again) {
      ctx.status = 400;
      ctx.body = compiledPasswordPage({
        token: ctx.request.body.token,
        error: 'Password fields do not match',
        min_password_length: 5,
        max_password_length: 60,
      });
    } else {
      // set verified status to true
      token.user.password = ctx.request.body.password;
      // validate user entity
      const errors: ValidationError[] = await validate(token.user, {
        groups: ['login'], validationError: { target: false }
      }); // errors is an array of validation errors
      if (errors.length > 0) {
        // return BAD REQUEST status code and errors array
        ctx.status = 400;
        ctx.body = errors;
        return;
      }
      // identifier to detect password change
      token.user.password_identifier = crypto.randomBytes(5).toString('hex');
      await token.user.hashPassword();
      // save changes to user
      await tokenRepository.save(token);
      // delete token
      await tokenRepository.remove(token);
      // return OK status code and jwt token
      ctx.status = 200;
      ctx.body = 'Password Changed';
    }
  }
}

