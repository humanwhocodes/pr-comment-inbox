import { defineMiddleware } from 'astro:middleware';
import { getToken } from './lib/auth';

export const onRequest = defineMiddleware((context, next) => {
  context.locals.token = getToken(context.cookies);
  return next();
});
