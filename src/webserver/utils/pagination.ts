/**
 * Утилиты для пагинации
 */

import { PaginationParams, PaginatedResponse } from '../types';

/**
 * Применяет пагинацию к массиву данных
 */
export function paginate<T>(
  data: T[],
  params: PaginationParams
): PaginatedResponse<T> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  
  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const end = start + limit;
  
  const paginatedData = data.slice(start, end);
  
  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Создает пагинированный ответ для Prisma
 */
export async function paginatePrisma<T>(
  model: any,
  params: PaginationParams & { where?: any },
  include?: any
): Promise<PaginatedResponse<T>> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;
  
  // Получаем общее количество
  const total = await model.count({ where: params.where });
  const totalPages = Math.ceil(total / limit);
  
  // Получаем данные
  const data = await model.findMany({
    where: params.where,
    skip,
    take: limit,
    orderBy: params.sortBy ? {
      [params.sortBy]: params.sortOrder || 'desc'
    } : undefined,
    include
  });
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Создает cursor-based пагинацию
 */
export async function paginateCursor<T>(
  model: any,
  params: PaginationParams & { where?: any },
  cursorField: string = 'id',
  include?: any
): Promise<PaginatedResponse<T> & { nextCursor?: string }> {
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  
  const queryOptions: any = {
    where: params.where,
    take: limit + 1, // Берем на 1 больше чтобы определить есть ли следующая страница
    orderBy: params.sortBy ? {
      [params.sortBy]: params.sortOrder || 'desc'
    } : { [cursorField]: 'desc' },
    include
  };
  
  // Если есть курсор, добавляем условие
  if (params.cursor) {
    queryOptions.cursor = {
      [cursorField]: params.cursor
    };
    queryOptions.skip = 1; // Пропускаем сам курсор
  }
  
  const items = await model.findMany(queryOptions);
  
  let hasNext = false;
  let nextCursor: string | undefined;
  
  if (items.length > limit) {
    hasNext = true;
    items.pop(); // Удаляем лишний элемент
    const lastItem = items[items.length - 1];
    nextCursor = lastItem[cursorField];
  }
  
  // Для cursor-based пагинации не можем точно знать total
  const response: PaginatedResponse<T> & { nextCursor?: string } = {
    data: items,
    pagination: {
      page: 1, // Для cursor-based всегда 1
      limit,
      total: -1, // Неизвестно
      totalPages: -1, // Неизвестно
      hasNext,
      hasPrev: !!params.cursor, // Если есть курсор, значит есть предыдущие
      nextCursor
    }
  };
  
  return response;
}

/**
 * Валидирует параметры пагинации
 */
export function validatePaginationParams(params: any): PaginationParams {
  return {
    page: parseInt(params.page) || 1,
    limit: parseInt(params.limit) || 20,
    cursor: params.cursor,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder === 'asc' ? 'asc' : 'desc'
  };
}