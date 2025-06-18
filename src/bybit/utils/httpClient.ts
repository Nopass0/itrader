/**
 * HTTP client for Bybit API requests
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { P2PConfig, ApiResponse, P2PError } from '../types/p2p';
import { SignatureUtils } from './signature';
import { TimeSync } from './timeSync';

export class HttpClient {
  private axios: AxiosInstance;
  private config: P2PConfig;
  private baseUrl: string;

  constructor(config: P2PConfig) {
    this.config = config;
    this.baseUrl = config.testnet 
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com';

    // Initialize time synchronization
    TimeSync.forceSync(config.testnet).catch(err => {
      console.error('[HttpClient] Failed to sync time on initialization:', err);
    });

    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-BAPI-API-KEY': config.apiKey,
        'X-BAPI-SIGN-TYPE': 2,
      },
    });

    // Add request interceptor for authentication
    this.axios.interceptors.request.use(
      (config) => this.addAuthHeaders(config),
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.axios.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleError(error)
    );
  }

  /**
   * Add authentication headers to request
   */
  private addAuthHeaders(config: AxiosRequestConfig): AxiosRequestConfig {
    const timestamp = SignatureUtils.getTimestamp();
    const recvWindow = this.config.recvWindow?.toString() || '50000';
    
    // Prepare query string
    let queryString = '';
    
    if (config.method?.toUpperCase() === 'GET' && config.params) {
      queryString = SignatureUtils.generateQueryString(config.params);
    } else if (config.method?.toUpperCase() === 'POST') {
      // For POST requests, Bybit expects JSON string in signature
      if (config.data && typeof config.data === 'object') {
        // For empty objects, use empty string
        if (Object.keys(config.data).length === 0) {
          queryString = '';
          // Don't send empty object
          config.data = undefined;
        } else {
          // For non-empty objects, use JSON string
          queryString = JSON.stringify(config.data);
        }
      } else {
        queryString = '';
      }
    }

    // Generate signature
    const signature = SignatureUtils.generateSignature(
      timestamp,
      this.config.apiKey,
      recvWindow,
      queryString,
      this.config.apiSecret
    );

    // Add headers
    if (!config.headers) {
      config.headers = {};
    }

    config.headers['X-BAPI-API-KEY'] = this.config.apiKey;
    config.headers['X-BAPI-SIGN-TYPE'] = 2;
    config.headers['X-BAPI-TIMESTAMP'] = timestamp;
    config.headers['X-BAPI-RECV-WINDOW'] = recvWindow;
    config.headers['X-BAPI-SIGN'] = signature;

    // Only log in debug mode if explicitly requested via environment variable
    if (this.config.debugMode && process.env.VERBOSE_HTTP_LOG === 'true') {
      console.log('Request Details:');
      console.log('  Method:', config.method);
      console.log('  URL:', config.url);
      console.log('  Query String:', queryString);
    }

    return config;
  }

  /**
   * Handle successful response
   */
  private handleResponse<T>(response: AxiosResponse<ApiResponse<T>>): ApiResponse<T> {
    const data = response.data;
    
    // Only log raw response in debug mode if explicitly requested
    if (this.config.debugMode && process.env.VERBOSE_HTTP_LOG === 'true') {
      console.log('[HTTPClient] Raw response data:', JSON.stringify(data, null, 2));
    }
    
    // Bybit uses both retCode and ret_code
    const retCode = data.retCode ?? data.ret_code;
    const retMsg = data.retMsg ?? data.ret_msg;
    
    if (retCode !== 0 && retCode !== undefined) {
      throw this.createError(retMsg, retCode, data);
    }
    
    // Handle response with ret_code (older format)
    if (data.ret_code === 0) {
      return {
        retCode: 0,
        retMsg: data.ret_msg || "SUCCESS",
        result: data.result,
        time: data.time_now
      } as ApiResponse<T>;
    }
    
    // Ensure we always have a valid response structure
    if (!data.hasOwnProperty('result')) {
      console.warn('[HTTPClient] Response missing result property:', data);
      // Return the data as-is but log warning
    }
    
    return data;
  }

  /**
   * Handle error response
   */
  private handleError(error: any): never {
    if (error.response?.data) {
      const errorData = error.response.data;
      const statusCode = error.response.status;
      
      // Enhanced error messages for common P2P API errors
      let errorMessage = errorData.retMsg || errorData.ret_msg || error.message;
      const retCode = errorData.retCode || errorData.ret_code;
      
      if (statusCode === 404) {
        errorMessage = `Endpoint not found: ${error.config?.url}. This might indicate that P2P API permissions are not enabled for this API key or the endpoint has changed.`;
      } else if (statusCode === 403) {
        errorMessage = `Access forbidden: ${errorMessage}. Please ensure your API key has P2P permissions enabled and you are a verified P2P advertiser.`;
      } else if (statusCode === 401) {
        errorMessage = `Authentication failed: ${errorMessage}. Please check your API key and secret.`;
      } else if (retCode === 10001 || errorMessage.includes('Request parameter error')) {
        // Special handling for parameter errors
        errorMessage = `Request parameter error: ${errorMessage}. `;
        if (error.config?.data) {
          const data = typeof error.config.data === 'string' ? JSON.parse(error.config.data) : error.config.data;
          if (data.paymentIds && Array.isArray(data.paymentIds)) {
            errorMessage += `Payment IDs provided: ${JSON.stringify(data.paymentIds)}. `;
            errorMessage += `Note: Bybit expects payment method IDs (numeric strings), not payment method names. `;
            errorMessage += `Use the getPaymentMethods() API to get your configured payment method IDs.`;
          }
          errorMessage += `\nFull request data: ${JSON.stringify(data, null, 2)}`;
        }
        // Include the API error details if available
        if (errorData.result) {
          errorMessage += `\nAPI error details: ${JSON.stringify(errorData.result, null, 2)}`;
        }
      }
      
      // Special handling for signature errors
      if (errorData.ret_code === 10004 || errorData.retCode === 10004) {
        errorMessage = `Signature verification failed: ${errorMessage}. This usually means the API secret is incorrect or the signature calculation has an issue.`;
        if (this.config.debugMode) {
          console.error('Signature Error Details:', errorData);
        }
      }
      
      throw this.createError(
        errorMessage,
        errorData.retCode || errorData.ret_code || statusCode,
        errorData
      );
    }
    
    throw this.createError(error.message, 'NETWORK_ERROR', error);
  }

  /**
   * Create P2P error
   */
  private createError(message: string, code?: string | number, details?: any): P2PError {
    const error = new Error(message) as P2PError;
    error.code = code ? code.toString() : 'UNKNOWN_ERROR';
    error.retCode = typeof code === 'number' ? code : undefined;
    error.details = details;
    return error;
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.axios.get<ApiResponse<T>>(endpoint, { params });
    return response as any;
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.axios.post<ApiResponse<T>>(endpoint, data);
    return response as any;
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.axios.delete<ApiResponse<T>>(endpoint, { data });
    return response as any;
  }
}