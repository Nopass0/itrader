/**
 * Контроллер управления курсами валют
 */

import type { AuthenticatedSocket } from "../types";
import { handleError, handleSuccess } from "../middleware/auth";
import { validatePaginationParams, paginatePrisma } from "../utils/pagination";
import { PrismaClient } from "../../../generated/prisma";
import { db } from "../../db";

const prisma = new PrismaClient();

export class ExchangeRateController {
  /**
   * Получение текущего курса и настроек
   */
  static async get(socket: AuthenticatedSocket, callback: Function) {
    try {
      // Получаем данные из ExchangeRateManager
      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const exchangeRateManager = getExchangeRateManager();
      const config = exchangeRateManager.getConfig();
      const currentRate = await exchangeRateManager.getRate();
      
      // Get markup from DB (still stored there)
      const markup = parseFloat(
        (await db.getSetting("exchangeRateMarkup")) || "2.5",
      );

      // Получаем последнюю запись из истории
      const lastHistory = await prisma.exchangeRateHistory.findFirst({
        orderBy: { timestamp: "desc" },
      });

      handleSuccess(
        {
          mode: config.mode,
          constantRate: config.constantRate,
          markup,
          currentRate,
          lastUpdate: lastHistory?.timestamp || config.lastUpdate,
          source: lastHistory?.source,
        },
        undefined,
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Установка константного курса
   */
  static async setConstant(
    socket: AuthenticatedSocket,
    data: { rate: number },
    callback: Function,
  ) {
    try {
      // Только админы и операторы могут менять курс
      if (socket.role === "viewer") {
        throw new Error("Viewers cannot change exchange rate");
      }

      if (!data.rate || data.rate <= 0) {
        throw new Error("Invalid rate value");
      }

      // Update ExchangeRateManager - first set mode, then rate
      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const exchangeRateManager = getExchangeRateManager();
      
      // Set mode to constant first
      await exchangeRateManager.setMode("constant");
      // Then set the rate
      await exchangeRateManager.setRate(data.rate);

      // Записываем в историю
      await prisma.exchangeRateHistory.create({
        data: {
          rate: data.rate,
          source: "manual",
          metadata: JSON.stringify({
            setBy: socket.userId,
            mode: "constant",
          }),
        },
      });

      // Emit событие об изменении курса всем клиентам, включая отправителя
      socket.server.emit("rate:changed", {
        oldRate: exchangeRateManager.getConfig().constantRate,
        newRate: data.rate,
        mode: "constant",
      });

      handleSuccess(
        {
          mode: "constant",
          rate: data.rate,
        },
        "Constant exchange rate set successfully",
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Переключение режима курса
   */
  static async toggleMode(socket: AuthenticatedSocket, callback: Function) {
    try {
      // Только админы и операторы могут менять режим
      if (socket.role === "viewer") {
        throw new Error("Viewers cannot change exchange rate mode");
      }

      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const manager = getExchangeRateManager();
      const config = manager.getConfig();
      
      const currentMode = config.mode;
      const newMode = currentMode === "automatic" ? "constant" : "automatic";

      await manager.setMode(newMode);

      // Записываем в историю
      await prisma.exchangeRateHistory.create({
        data: {
          rate: await manager.getRate(),
          source: "mode_change",
          metadata: JSON.stringify({
            changedBy: socket.userId,
            oldMode: currentMode,
            newMode,
          }),
        },
      });

      // Emit событие всем клиентам
      socket.server.emit("rate:changed", {
        oldRate: await manager.getRate(),
        newRate: await manager.getRate(),
        mode: newMode,
      });

      handleSuccess(
        {
          mode: newMode,
          currentRate: await manager.getRate(),
        },
        `Exchange rate mode switched to ${newMode}`,
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * История изменений курса
   */
  static async history(
    socket: AuthenticatedSocket,
    data: any,
    callback: Function,
  ) {
    try {
      const params = validatePaginationParams(data);

      const where: any = {};

      if (data.source) {
        where.source = data.source;
      }

      if (data.dateFrom || data.dateTo) {
        where.timestamp = {};
        if (data.dateFrom) {
          where.timestamp.gte = new Date(data.dateFrom);
        }
        if (data.dateTo) {
          where.timestamp.lte = new Date(data.dateTo);
        }
      }

      const response = await paginatePrisma(prisma.exchangeRateHistory, {
        ...params,
        where,
        sortBy: params.sortBy || "timestamp",
      });

      handleSuccess(response, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Установка наценки
   */
  static async setMarkup(
    socket: AuthenticatedSocket,
    data: { markup: number },
    callback: Function,
  ) {
    try {
      // Только админы могут менять наценку
      if (socket.role !== "admin") {
        throw new Error("Only admins can change markup");
      }

      if (data.markup < 0 || data.markup > 100) {
        throw new Error("Markup must be between 0 and 100");
      }

      await db.setSetting("exchangeRateMarkup", data.markup.toString());

      // Если режим автоматический, обновляем курс
      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const manager = getExchangeRateManager();
      if (manager.getConfig().mode === "automatic") {
        await manager.updateRateAsync();
      }

      handleSuccess(
        {
          markup: data.markup,
          currentRate: await manager.getRate(),
        },
        "Markup updated successfully",
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Принудительное обновление курса
   */
  static async forceUpdate(socket: AuthenticatedSocket, callback: Function) {
    try {
      // Только админы и операторы могут обновлять
      if (socket.role === "viewer") {
        throw new Error("Viewers cannot force update");
      }

      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const manager = getExchangeRateManager();
      
      if (manager.getConfig().mode === "constant") {
        throw new Error("Cannot force update in constant mode");
      }

      const newRate = await manager.updateRateAsync();

      handleSuccess(
        {
          rate: newRate,
          source: "manual_update",
        },
        "Exchange rate updated successfully",
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение статистики по курсам
   */
  static async getStatistics(
    socket: AuthenticatedSocket,
    data: { period?: "hour" | "day" | "week" | "month" },
    callback: Function,
  ) {
    try {
      const period = data.period || "day";
      let dateFrom: Date;

      switch (period) {
        case "hour":
          dateFrom = new Date(Date.now() - 60 * 60 * 1000);
          break;
        case "day":
          dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case "week":
          dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const history = await prisma.exchangeRateHistory.findMany({
        where: {
          timestamp: {
            gte: dateFrom,
          },
        },
        orderBy: { timestamp: "asc" },
      });

      // Вычисляем статистику
      const rates = history.map((h) => h.rate);
      const min = Math.min(...rates);
      const max = Math.max(...rates);
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      const current = rates[rates.length - 1] || 0;

      // Группируем по источникам
      const sources = await prisma.exchangeRateHistory.groupBy({
        by: ["source"],
        where: {
          timestamp: {
            gte: dateFrom,
          },
        },
        _count: {
          id: true,
        },
      });

      handleSuccess(
        {
          period,
          statistics: {
            min,
            max,
            avg,
            current,
            count: history.length,
          },
          sources,
          history: history.map((h) => ({
            rate: h.rate,
            timestamp: h.timestamp,
            source: h.source,
          })),
        },
        undefined,
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение правил автоматического курса
   */
  static async getRules(socket: AuthenticatedSocket, callback: Function) {
    try {
      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const manager = getExchangeRateManager();
      const rules = await manager.getRules();

      handleSuccess(rules, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Создание правила автоматического курса
   */
  static async createRule(
    socket: AuthenticatedSocket,
    data: {
      name: string;
      priority: number;
      timeStart?: string;
      timeEnd?: string;
      minAmount?: number;
      maxAmount?: number;
      pageNumber: number;
      adIndex: number;
      priceAdjustment: number;
      enabled: boolean;
    },
    callback: Function,
  ) {
    try {
      // Только админы могут создавать правила
      if (socket.role !== "admin") {
        throw new Error("Only admins can create rate rules");
      }

      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const manager = getExchangeRateManager();
      const rule = await manager.createRule(data);

      handleSuccess(rule, "Rate rule created successfully", callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление правила автоматического курса
   */
  static async updateRule(
    socket: AuthenticatedSocket,
    data: {
      id: string;
      updates: {
        name?: string;
        priority?: number;
        timeStart?: string;
        timeEnd?: string;
        minAmount?: number;
        maxAmount?: number;
        pageNumber?: number;
        adIndex?: number;
        priceAdjustment?: number;
        enabled?: boolean;
      };
    },
    callback: Function,
  ) {
    try {
      // Только админы могут обновлять правила
      if (socket.role !== "admin") {
        throw new Error("Only admins can update rate rules");
      }

      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const manager = getExchangeRateManager();
      const rule = await manager.updateRule(data.id, data.updates);

      handleSuccess(rule, "Rate rule updated successfully", callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Удаление правила автоматического курса
   */
  static async deleteRule(
    socket: AuthenticatedSocket,
    data: { id: string },
    callback: Function,
  ) {
    try {
      // Только админы могут удалять правила
      if (socket.role !== "admin") {
        throw new Error("Only admins can delete rate rules");
      }

      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const manager = getExchangeRateManager();
      await manager.deleteRule(data.id);

      handleSuccess(null, "Rate rule deleted successfully", callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Тестирование правила автоматического курса
   */
  static async testRule(
    socket: AuthenticatedSocket,
    data: {
      name: string;
      priority: number;
      timeStart?: string;
      timeEnd?: string;
      minAmount?: number;
      maxAmount?: number;
      pageNumber: number;
      adIndex: number;
      priceAdjustment: number;
      enabled: boolean;
    },
    callback: Function,
  ) {
    try {
      // Только админы и операторы могут тестировать правила
      if (socket.role === "viewer") {
        throw new Error("Viewers cannot test rate rules");
      }

      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const manager = getExchangeRateManager();
      const result = await manager.testRule(data);

      handleSuccess(result, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Получение статистики курсов с Bybit P2P
   */
  static async getBybitStatistics(
    socket: AuthenticatedSocket,
    data: { pageNumber?: number },
    callback: Function,
  ) {
    try {
      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const manager = getExchangeRateManager();
      const statistics = await manager.getRateStatistics(data.pageNumber || 1);

      handleSuccess(statistics, undefined, callback);
    } catch (error) {
      handleError(error, callback);
    }
  }

  /**
   * Обновление конфигурации
   */
  static async updateConfig(
    socket: AuthenticatedSocket,
    data: {
      updateInterval?: number;
      fallbackRate?: number;
    },
    callback: Function,
  ) {
    try {
      // Только админы могут обновлять конфигурацию
      if (socket.role !== "admin") {
        throw new Error("Only admins can update configuration");
      }

      const { getExchangeRateManager } = await import(
        "../../services/exchangeRateManager"
      );
      const manager = getExchangeRateManager();
      await manager.updateConfig(data);

      handleSuccess(
        {
          ...manager.getConfig(),
          ...data,
        },
        "Configuration updated successfully",
        callback,
      );
    } catch (error) {
      handleError(error, callback);
    }
  }
}
