import { Elysia, t } from 'elysia';
import { accountsHandler } from './accounts';
import { accountHandler } from './account';
import { transactionsHandler } from './transactions';
import { accountTransactionsHandler } from './accountTransactions';
import { smsHandler } from './sms';
import { accountSmsHandler } from './accountSms';
import { pushHandler } from './push';
import { accountPushHandler } from './accountPush';

export function gateRoutes(app: Elysia): Elysia {
  return app
    .get('/accounts', accountsHandler, {
      query: t.Object({
        token: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get all Gate.cx accounts',
        description: 'Retrieve information about all Gate.cx accounts',
        tags: ['Gate.cx'],
      },
    })
    .get('/account/:account_id', accountHandler, {
      params: t.Object({
        account_id: t.Numeric(),
      }),
      query: t.Object({
        token: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get Gate.cx account',
        description: 'Retrieve information about a specific Gate.cx account',
        tags: ['Gate.cx'],
      },
    })
    .get('/transactions', transactionsHandler, {
      query: t.Object({
        token: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        status: t.Optional(t.String()),
        transaction_id: t.Optional(t.String()),
        wallet: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get Gate.cx transactions',
        description: 'Retrieve transactions from all Gate.cx accounts',
        tags: ['Gate.cx'],
      },
    })
    .get('/account/:account_id/transactions', accountTransactionsHandler, {
      params: t.Object({
        account_id: t.Numeric(),
      }),
      query: t.Object({
        token: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        status: t.Optional(t.String()),
        transaction_id: t.Optional(t.String()),
        wallet: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get Gate.cx account transactions',
        description: 'Retrieve transactions from a specific Gate.cx account',
        tags: ['Gate.cx'],
      },
    })
    .get('/sms', smsHandler, {
      query: t.Object({
        token: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        status: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'Get Gate.cx SMS messages',
        description: 'Retrieve SMS messages from all Gate.cx accounts',
        tags: ['Gate.cx'],
      },
    })
    .get('/account/:account_id/sms', accountSmsHandler, {
      params: t.Object({
        account_id: t.Numeric(),
      }),
      query: t.Object({
        token: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        status: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'Get Gate.cx account SMS messages',
        description: 'Retrieve SMS messages from a specific Gate.cx account',
        tags: ['Gate.cx'],
      },
    })
    .get('/push', pushHandler, {
      query: t.Object({
        token: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        status: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'Get Gate.cx push notifications',
        description: 'Retrieve push notifications from all Gate.cx accounts',
        tags: ['Gate.cx'],
      },
    })
    .get('/account/:account_id/push', accountPushHandler, {
      params: t.Object({
        account_id: t.Numeric(),
      }),
      query: t.Object({
        token: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        status: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'Get Gate.cx account push notifications',
        description: 'Retrieve push notifications from a specific Gate.cx account',
        tags: ['Gate.cx'],
      },
    });
}