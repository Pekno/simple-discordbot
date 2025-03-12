import { createLogger, format, Logger, transports } from 'winston';
import path from 'path';
import 'winston-daily-rotate-file';

const { combine, timestamp, json, prettyPrint, errors } = format;

/**
 * Singleton service for managing Winston loggers
 * Provides centralized logging functionality with file rotation and error tracking
 */
class LoggerService {
	private static instance: LoggerService;
	private loggers: Map<string, Logger> = new Map();
	private errorLog: string = path.join(__dirname, `../logs/errors.log`);

	/**
	 * Private constructor to prevent direct instantiation (singleton pattern)
	 */
	private constructor() {}

	/**
	 * Gets the singleton instance of LoggerService
	 * @returns The singleton LoggerService instance
	 */
	public static getInstance(): LoggerService {
		if (!LoggerService.instance) {
			LoggerService.instance = new LoggerService();
		}
		return LoggerService.instance;
	}

	/**
	 * Gets or creates a logger with the specified ID
	 * @param id The logger identifier (default: 'default')
	 * @returns A Winston Logger instance
	 */
	public get(id: string = 'default'): Logger {
		if (!this.loggers.has(id)) {
			const logFileName = path.join(__dirname, `../logs/${id}-%DATE%.log`);

			const newLogger = createLogger({
				level: 'info',
				format: combine(
					errors({ stack: true }),
					json(),
					timestamp(),
					prettyPrint()
				),
				transports: [
					new transports.Console(),
					new transports.DailyRotateFile({
						filename: logFileName,
						datePattern: 'YYYY-MM-DD',
						zippedArchive: true,
						maxFiles: '30d',
					}),
					new transports.File({
						level: 'error',
						filename: this.errorLog,
						zippedArchive: true,
					}),
				],
				exitOnError: false,
			});

			this.loggers.set(id, newLogger);
		}

		return this.loggers.get(id)!;
	}
}

/**
 * Exported singleton instance of LoggerService
 * Use this to access logging functionality throughout the application
 */
export const Loggers = LoggerService.getInstance();
