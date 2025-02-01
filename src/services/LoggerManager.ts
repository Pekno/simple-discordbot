import { createLogger, format, Logger, transports } from 'winston';
import path from 'path';
import 'winston-daily-rotate-file';

const { combine, timestamp, json, prettyPrint, errors } = format;

class LoggerService {
	private static instance: LoggerService;
	private loggers: Map<string, Logger> = new Map();
	private errorLog: string = path.join(__dirname, `../logs/errors.log`);

	// Private constructor to prevent direct instantiation
	private constructor() {}

	// Get the singleton instance of LoggerManager
	public static getInstance(): LoggerService {
		if (!LoggerService.instance) {
			LoggerService.instance = new LoggerService();
		}
		return LoggerService.instance;
	}

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

export const Loggers = LoggerService.getInstance();
