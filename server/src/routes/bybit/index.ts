import { Elysia, t } from 'elysia';
import { accountsHandler } from './accounts';
import { accountHandler } from './account';
import { transactionsHandler } from './transactions';
import { accountTransactionsHandler } from './accountTransactions';

export function bybitRoutes(app: Elysia): Elysia {
  return app
    .get('/accounts', accountsHandler, {
      query: t.Object({
        token: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get all Bybit accounts',
        description: 'Retrieve information about all Bybit accounts',
        tags: ['Bybit'],
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
        summary: 'Get Bybit account',
        description: 'Retrieve information about a specific Bybit account',
        tags: ['Bybit'],
      },
    })
    .get('/transactions', transactionsHandler, {
      query: t.Object({
        token: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        status: t.Optional(t.String()),
        transaction_id: t.Optional(t.String()),
        category: t.Optional(t.String()),
        symbol: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get Bybit transactions',
        description: 'Retrieve transactions from all Bybit accounts',
        tags: ['Bybit'],
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
        category: t.Optional(t.String()),
        symbol: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get Bybit account transactions',
        description: 'Retrieve transactions from a specific Bybit account',
        tags: ['Bybit'],
      },
    });
}