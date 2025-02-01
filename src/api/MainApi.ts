import axios, {
	AxiosInstance,
	AxiosResponse,
	RawAxiosRequestHeaders,
} from 'axios';
import { ApiRequest } from '../model/ApiRequest';
import { Loggers } from '../services/LoggerManager';

export class MainApi {
	private queue: ApiRequest[] = [];
	private maxRequestsPerMinute: number;
	private requestInterval: number;
	private currentRequestCount: number;
	private timer: NodeJS.Timeout | null;
	private apiHeader: RawAxiosRequestHeaders | null;
	private axiosInstance: AxiosInstance;

	private get apiName() {
		return (<any>this).constructor.name;
	}

	constructor(
		apiHeader: RawAxiosRequestHeaders = {},
		maxRequestsPerMinute: number = -1
	) {
		this.apiHeader = apiHeader;
		this.maxRequestsPerMinute = maxRequestsPerMinute;
		this.requestInterval = 60000 / maxRequestsPerMinute;
		this.currentRequestCount = 0;
		this.timer = null;

		this.axiosInstance = axios.create({
			headers: this.apiHeader,
		});

		this.startProcessing();
	}

	public get(url: string): Promise<any> {
		return this.call(url, { method: 'GET' });
	}

	public call(url: string, options?: any): Promise<AxiosResponse<any, any>> {
		const encodedUrl = encodeURI(url);
		return new Promise((resolve, reject) => {
			Loggers.get().info(`${this.apiName} : ADDED to queue "${encodedUrl}"`);
			this.queue.push({ url: encodedUrl, options, resolve, reject });
		});
	}

	private async processQueue() {
		if (
			!this.queue?.length &&
			(this.maxRequestsPerMinute !== -1 ||
				this.currentRequestCount >= this.maxRequestsPerMinute)
		)
			return;

		const { url, options, resolve, reject } = this.queue.shift()!;
		this.currentRequestCount++;

		try {
			Loggers.get().info(
				`${this.apiName} : PROCESS from queue "${url}" -> ${this.currentRequestCount}/${this.maxRequestsPerMinute}`
			);
			const response = await this.axiosInstance.get(url, options);
			resolve(response);
		} catch (error) {
			reject(error);
		}
	}

	private startProcessing() {
		if (this.timer === null) {
			this.timer = setInterval(() => {
				this.processQueue();
			}, this.requestInterval);

			setInterval(() => {
				this.currentRequestCount = 0;
			}, 60000);
		}
	}

	private stopProcessing() {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
}
