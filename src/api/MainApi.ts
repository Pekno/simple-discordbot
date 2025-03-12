import axios, {
	AxiosInstance,
	AxiosResponse,
	RawAxiosRequestHeaders,
} from 'axios';
import { ApiRequest } from '../model/ApiRequest';
import { Loggers } from '../services/LoggerManager';
import { CircuitBreaker, CircuitState } from '../utils/CircuitBreaker';
import { LocaleError } from '../model/LocaleError';

/**
 * API client with request queuing, rate limiting, and circuit breaker functionality
 * Provides methods for making HTTP requests with automatic retry and failure handling
 */
export class MainApi {
	/** Queue of pending API requests */
	private queue: ApiRequest[] = [];

	/** Maximum number of requests allowed per minute (-1 for unlimited) */
	private maxRequestsPerMinute: number;

	/** Interval between queue processing in milliseconds */
	private requestInterval: number;

	/** Current count of requests made in the current minute */
	private currentRequestCount: number;

	/** Timer for processing the request queue */
	private queueTimer: NodeJS.Timeout | null;

	/** Timer for resetting the request count every minute */
	private resetTimer: NodeJS.Timeout | null;

	/** Headers to include with all requests */
	private apiHeader: RawAxiosRequestHeaders | null;

	/** Axios instance for making HTTP requests */
	private axiosInstance: AxiosInstance;

	/** Circuit breaker for preventing cascading failures */
	private circuitBreaker: CircuitBreaker;

	/**
	 * Gets the name of the API class for logging purposes
	 * @returns The name of the class that extends MainApi
	 * @private
	 */
	private get apiName() {
		return (<any>this).constructor.name;
	}

	/**
	 * Creates a new MainApi instance
	 * @param apiHeader Headers to include with all requests
	 * @param maxRequestsPerMinute Maximum number of requests allowed per minute (-1 for unlimited)
	 */
	constructor(
		apiHeader: RawAxiosRequestHeaders = {},
		maxRequestsPerMinute: number = -1
	) {
		this.circuitBreaker = new CircuitBreaker();
		this.apiHeader = apiHeader;
		this.maxRequestsPerMinute = maxRequestsPerMinute;
		this.requestInterval = 60000 / maxRequestsPerMinute;
		this.currentRequestCount = 0;
		this.queueTimer = null;
		this.resetTimer = null;

		this.axiosInstance = axios.create({
			headers: this.apiHeader,
		});

		this.startProcessing();
	}

	/**
	 * Performs a request with retry logic and circuit breaker protection
	 * @param requestFn Function that performs the actual request
	 * @param maxRetries Maximum number of retry attempts
	 * @param delay Base delay between retries in ms (will be multiplied by 2^attempt for exponential backoff)
	 * @returns The result of the request
	 * @throws Error if all retry attempts fail
	 */
	private async retryableRequest<T>(
		requestFn: () => Promise<T>,
		maxRetries: number = 3,
		delay: number = 1000
	): Promise<T> {
		if (this.circuitBreaker.isOpen()) {
			const state = this.circuitBreaker.getState();
			const stateStr = CircuitState[state];
			Loggers.get().warn(`Circuit breaker is ${stateStr}, rejecting request`);
			throw new LocaleError('error.riot.circuit_open', {
				message: `Too many failures, circuit is ${stateStr.toLowerCase()}`,
			});
		}

		let lastError: Error | null = null;
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const result = await requestFn();
				this.circuitBreaker.recordSuccess();
				return result;
			} catch (error: any) {
				lastError = error;
				Loggers.get().warn(
					`Request failed (attempt ${attempt + 1}/${maxRetries}): ${error.message}`
				);

				// Don't retry for certain error types
				if (error.response?.status === 404 || error.response?.status === 403) {
					throw error;
				}

				// Exponential backoff
				const waitTime = delay * Math.pow(2, attempt);
				Loggers.get().info(`Retrying after ${waitTime}ms`);
				await new Promise((resolve) => setTimeout(resolve, waitTime));
			}
		}

		this.circuitBreaker.recordFailure();
		throw lastError || new Error('Unknown error during retry');
	}

	/**
	 * Performs a GET request
	 * @param url The URL to request
	 * @param options Additional options for the request
	 * @returns Promise resolving to the response
	 */
	public get(url: string, options?: any): Promise<any> {
		return this.retryableRequest(() =>
			this.call(url, { method: 'GET', ...options })
		);
	}

	/**
	 * Performs a POST request
	 * @param url The URL to request
	 * @param data The data to send in the request body
	 * @param options Additional options for the request
	 * @returns Promise resolving to the response
	 */
	public post(url: string, data: any, options?: any): Promise<any> {
		return this.retryableRequest(() =>
			this.call(url, { method: 'POST', data, ...options })
		);
	}

	/**
	 * Performs a PUT request
	 * @param url The URL to request
	 * @param data The data to send in the request body
	 * @param options Additional options for the request
	 * @returns Promise resolving to the response
	 */
	public put(url: string, data: any, options?: any): Promise<any> {
		return this.retryableRequest(() =>
			this.call(url, { method: 'PUT', data, ...options })
		);
	}

	/**
	 * Performs a DELETE request
	 * @param url The URL to request
	 * @param options Additional options for the request
	 * @returns Promise resolving to the response
	 */
	public delete(url: string, options?: any): Promise<any> {
		return this.retryableRequest(() =>
			this.call(url, { method: 'DELETE', ...options })
		);
	}

	/**
	 * Performs a PATCH request
	 * @param url The URL to request
	 * @param data The data to send in the request body
	 * @param options Additional options for the request
	 * @returns Promise resolving to the response
	 */
	public patch(url: string, data: any, options?: any): Promise<any> {
		return this.retryableRequest(() =>
			this.call(url, { method: 'PATCH', data, ...options })
		);
	}

	/**
	 * Adds a request to the queue
	 * @param url The URL to request
	 * @param options Options for the request
	 * @returns Promise resolving to the response
	 */
	public call(url: string, options?: any): Promise<AxiosResponse<any, any>> {
		const encodedUrl = encodeURI(url);
		return new Promise((resolve, reject) => {
			Loggers.get().info(`${this.apiName} : ADDED to queue "${encodedUrl}"`);
			this.queue.push({ url: encodedUrl, options, resolve, reject });
		});
	}

	/**
	 * Processes the next request in the queue if rate limits allow
	 * Executes the request with the appropriate HTTP method and handles the response
	 * @private
	 */
	private async processQueue() {
		// Don't process if queue is empty or we've hit the rate limit (unless rate limiting is disabled)
		if (
			this.queue.length === 0 ||
			(this.maxRequestsPerMinute !== -1 &&
				this.currentRequestCount >= this.maxRequestsPerMinute)
		)
			return;

		const { url, options, resolve, reject } = this.queue.shift()!;
		this.currentRequestCount++;

		try {
			Loggers.get().info(
				`${this.apiName} : PROCESS from queue "${url}" -> ${this.currentRequestCount}/${this.maxRequestsPerMinute}`
			);
			// Use the method specified in options, defaulting to GET
			const method = options?.method?.toLowerCase() || 'get';
			let response;

			switch (method) {
				case 'post':
					response = await this.axiosInstance.post(url, options?.data, options);
					break;
				case 'put':
					response = await this.axiosInstance.put(url, options?.data, options);
					break;
				case 'delete':
					response = await this.axiosInstance.delete(url, options);
					break;
				case 'patch':
					response = await this.axiosInstance.patch(
						url,
						options?.data,
						options
					);
					break;
				case 'head':
					response = await this.axiosInstance.head(url, options);
					break;
				case 'options':
					response = await this.axiosInstance.options(url, options);
					break;
				case 'get':
				default:
					response = await this.axiosInstance.get(url, options);
					break;
			}
			resolve(response);
		} catch (error) {
			reject(error);
		}
	}

	/**
	 * Starts processing the request queue and rate limiting
	 */
	private startProcessing() {
		if (this.queueTimer === null) {
			// Start queue processing timer
			this.queueTimer = setInterval(async () => {
				try {
					await this.processQueue();
				} catch (error) {
					Loggers.get().error(
						`${this.apiName} : Error processing queue`,
						error
					);
				}
				this.processQueue();
			}, this.requestInterval);

			// Start rate limit reset timer
			this.resetTimer = setInterval(() => {
				this.currentRequestCount = 0;
			}, 60000);
		}
	}

	/**
	 * Stops processing the request queue and cleans up timers
	 */
	private stopProcessing() {
		// Clear queue processing timer
		if (this.queueTimer !== null) {
			clearInterval(this.queueTimer);
			this.queueTimer = null;
		}

		// Clear rate limit reset timer
		if (this.resetTimer !== null) {
			clearInterval(this.resetTimer);
			this.resetTimer = null;
		}
	}

	/**
	 * Disposes of the API instance, cleaning up resources
	 * This should be called when the API instance is no longer needed
	 */
	public dispose(): void {
		this.stopProcessing();
		// Clear any pending requests
		while (this.queue.length > 0) {
			const request = this.queue.shift();
			if (request) {
				request.reject(new Error('API instance disposed'));
			}
		}
		Loggers.get().info(`${this.apiName} : Disposed`);
	}
}
