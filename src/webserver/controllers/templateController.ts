/**
 * Контроллер управления шаблонами чата
 */

import type { AuthenticatedSocket } from '../types';
import { handleError, handleSuccess } from '../middleware/auth';
import { validatePaginationParams, paginatePrisma } from '../utils/pagination';
import { PrismaClient } from '../../../generated/prisma';

const prisma = new PrismaClient();

export class TemplateController {
  /**
   * Получение списка шаблонов
   */
  static async list(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function
  ) {
    try {
      const params = validatePaginationParams(data);
      
      const where: any = {};
      
      if (data.groupId) {
        where.groupId = data.groupId;
      }
      
      if (data.isActive !== undefined) {
        where.isActive = data.isActive;
      }
      
      if (data.search) {
        where.OR = [
          { name: { contains: data.search } },
          { message: { contains: data.search } },
          { keywords: { has: data.search } }
        ];
      }

      const response = await paginatePrisma(
        prisma.chatTemplate,
        {
          ...params,
          where,
          sortBy: params.sortBy || 'priority'
        },
        {
          group: true,
          _count: {
            select: { usageHistory: true }
          }
        }
      );

      handleSuccess(response, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение детальной информации о шаблоне
   */
  static async get(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      const template = await prisma.chatTemplate.findUnique({
        where: { id: data.id },
        include: {
          group: true,
          usageHistory: {
            orderBy: { usedAt: 'desc' },
            take: 10
          }
        }
      });

      if (!template) {
        throw new Error('Template not found');
      }

      // Получаем статистику использования
      const usageStats = await prisma.templateUsage.aggregate({
        where: { templateId: data.id },
        _count: {
          id: true
        }
      });

      handleSuccess(
        {
          ...template,
          statistics: {
            totalUsage: usageStats._count.id
          }
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Создание нового шаблона
   */
  static async create(
    socket: AuthenticatedSocket,
    data: {
      name: string;
      message: string;
      keywords: string[];
      groupId?: string;
      customReactions?: any;
      priority?: number;
      metadata?: any;
    },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут создавать шаблоны
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot create templates');
      }

      const template = await prisma.chatTemplate.create({
        data: {
          name: data.name,
          message: data.message,
          keywords: data.keywords,
          groupId: data.groupId,
          customReactions: data.customReactions ? JSON.stringify(data.customReactions) : null,
          priority: data.priority || 0,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          isActive: true
        },
        include: {
          group: true
        }
      });

      handleSuccess(template, 'Template created successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление шаблона
   */
  static async update(
    socket: AuthenticatedSocket,
    data: { id: string; updates: any },
    callback: Function
  ) {
    try {
      // Только админы и операторы могут обновлять
      if (socket.role === 'viewer') {
        throw new Error('Viewers cannot update templates');
      }

      const existing = await prisma.chatTemplate.findUnique({
        where: { id: data.id }
      });

      if (!existing) {
        throw new Error('Template not found');
      }

      // Подготавливаем данные для обновления
      const updateData: any = { ...data.updates };
      
      if (updateData.customReactions && typeof updateData.customReactions === 'object') {
        updateData.customReactions = JSON.stringify(updateData.customReactions);
      }
      
      if (updateData.metadata && typeof updateData.metadata === 'object') {
        updateData.metadata = JSON.stringify(updateData.metadata);
      }

      const template = await prisma.chatTemplate.update({
        where: { id: data.id },
        data: updateData,
        include: {
          group: true
        }
      });

      handleSuccess(template, 'Template updated', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Удаление шаблона
   */
  static async delete(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      // Только админы могут удалять
      if (socket.role !== 'admin') {
        throw new Error('Only admins can delete templates');
      }

      await prisma.chatTemplate.delete({
        where: { id: data.id }
      });

      handleSuccess(null, 'Template deleted', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение списка групп шаблонов
   */
  static async listGroups(
    socket: AuthenticatedSocket,
    callback: Function
  ) {
    try {
      const groups = await prisma.responseGroup.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { templates: true }
          }
        }
      });

      handleSuccess(groups, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Создание группы шаблонов
   */
  static async createGroup(
    socket: AuthenticatedSocket,
    data: {
      name: string;
      description?: string;
      color?: string;
    },
    callback: Function
  ) {
    try {
      // Только админы могут создавать группы
      if (socket.role !== 'admin') {
        throw new Error('Only admins can create groups');
      }

      const group = await prisma.responseGroup.create({
        data: {
          name: data.name,
          description: data.description,
          color: data.color
        }
      });

      handleSuccess(group, 'Group created successfully', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление группы
   */
  static async updateGroup(
    socket: AuthenticatedSocket,
    data: { id: string; updates: any },
    callback: Function
  ) {
    try {
      // Только админы могут обновлять группы
      if (socket.role !== 'admin') {
        throw new Error('Only admins can update groups');
      }

      const group = await prisma.responseGroup.update({
        where: { id: data.id },
        data: data.updates
      });

      handleSuccess(group, 'Group updated', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Удаление группы
   */
  static async deleteGroup(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function
  ) {
    try {
      // Только админы могут удалять группы
      if (socket.role !== 'admin') {
        throw new Error('Only admins can delete groups');
      }

      // Проверяем нет ли шаблонов в группе
      const templatesCount = await prisma.chatTemplate.count({
        where: { groupId: data.id }
      });

      if (templatesCount > 0) {
        throw new Error('Cannot delete group with templates');
      }

      await prisma.responseGroup.delete({
        where: { id: data.id }
      });

      handleSuccess(null, 'Group deleted', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Поиск подходящего шаблона по сообщению
   */
  static async findMatch(
    socket: AuthenticatedSocket,
    data: { message: string; context?: any },
    callback: Function
  ) {
    try {
      // Получаем все активные шаблоны
      const templates = await prisma.chatTemplate.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
        include: {
          group: true
        }
      });

      // Ищем совпадения по ключевым словам
      const messageLower = data.message.toLowerCase();
      const matches = [];

      for (const template of templates) {
        const score = template.keywords.reduce((acc, keyword) => {
          if (messageLower.includes(keyword.toLowerCase())) {
            return acc + 1;
          }
          return acc;
        }, 0);

        if (score > 0) {
          matches.push({
            template,
            score,
            matchedKeywords: template.keywords.filter(k => 
              messageLower.includes(k.toLowerCase())
            )
          });
        }
      }

      // Сортируем по score
      matches.sort((a, b) => b.score - a.score);

      // Берем лучшее совпадение
      const bestMatch = matches[0];

      if (bestMatch) {
        // Записываем использование
        await prisma.templateUsage.create({
          data: {
            templateId: bestMatch.template.id,
            context: data.context ? JSON.stringify(data.context) : null
          }
        });

        handleSuccess(
          {
            found: true,
            template: bestMatch.template,
            score: bestMatch.score,
            matchedKeywords: bestMatch.matchedKeywords
          },
          undefined,
          callback
        );
      } else {
        handleSuccess(
          {
            found: false,
            message: 'No matching template found'
          },
          undefined,
          callback
        );
      }
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Тестирование шаблона
   */
  static async test(
    socket: AuthenticatedSocket,
    data: { templateId: string; testMessage: string },
    callback: Function
  ) {
    try {
      const template = await prisma.chatTemplate.findUnique({
        where: { id: data.templateId }
      });

      if (!template) {
        throw new Error('Template not found');
      }

      // Проверяем совпадение
      const messageLower = data.testMessage.toLowerCase();
      const matchedKeywords = template.keywords.filter(k => 
        messageLower.includes(k.toLowerCase())
      );

      const isMatch = matchedKeywords.length > 0;

      handleSuccess(
        {
          isMatch,
          matchedKeywords,
          template: {
            name: template.name,
            message: template.message
          }
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Массовый импорт шаблонов
   */
  static async bulkImport(
    socket: AuthenticatedSocket,
    data: {
      templates: Array<{
        name: string;
        message: string;
        keywords: string[];
        groupName?: string;
      }>;
    },
    callback: Function
  ) {
    try {
      // Только админы могут импортировать
      if (socket.role !== 'admin') {
        throw new Error('Only admins can import templates');
      }

      const results = {
        created: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Получаем все группы для маппинга
      const groups = await prisma.responseGroup.findMany();
      const groupMap = new Map(groups.map(g => [g.name, g.id]));

      for (const templateData of data.templates) {
        try {
          let groupId = undefined;
          
          if (templateData.groupName) {
            groupId = groupMap.get(templateData.groupName);
            if (!groupId) {
              // Создаем группу если не существует
              const newGroup = await prisma.responseGroup.create({
                data: { name: templateData.groupName }
              });
              groupId = newGroup.id;
              groupMap.set(templateData.groupName, groupId);
            }
          }

          await prisma.chatTemplate.create({
            data: {
              name: templateData.name,
              message: templateData.message,
              keywords: templateData.keywords,
              groupId,
              isActive: true
            }
          });

          results.created++;
        } catch (error) {
          results.failed++;
          results.errors.push(`${templateData.name}: ${error.message}`);
        }
      }

      handleSuccess(results, 'Import completed', callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Экспорт шаблонов
   */
  static async export(
    socket: AuthenticatedSocket,
    data: { groupId?: string },
    callback: Function
  ) {
    try {
      const where: any = {};
      if (data.groupId) {
        where.groupId = data.groupId;
      }

      const templates = await prisma.chatTemplate.findMany({
        where,
        include: {
          group: true
        },
        orderBy: [
          { group: { name: 'asc' } },
          { priority: 'desc' },
          { name: 'asc' }
        ]
      });

      const exportData = templates.map(t => ({
        name: t.name,
        message: t.message,
        keywords: t.keywords,
        groupName: t.group?.name,
        priority: t.priority,
        isActive: t.isActive
      }));

      handleSuccess(
        {
          templates: exportData,
          count: exportData.length
        },
        undefined,
        callback
      );
    } catch (error) {
      handleError(error, callback);
    }
  }
}