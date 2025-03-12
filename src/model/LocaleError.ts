import i18n, { Replacements, I18n } from 'i18n';

/**
 * Custom error class for localized error messages
 * Extends the standard Error class to provide internationalization support
 */
export class LocaleError extends Error {
	/**
	 * Creates a new LocaleError instance
	 * @param i18nKey The key to look up in the localization files
	 * @param i18nArgs Optional replacement arguments for the localized message
	 * @param i18nInstance Optional i18n instance to use for localization (uses global instance if not provided)
	 */
	constructor(i18nKey: string, i18nArgs?: Replacements, i18nInstance?: I18n) {
		let message: string;
		const translator = i18nInstance || i18n;

		if (i18nArgs) {
			message = translator.__(i18nKey, i18nArgs);
		} else {
			message = translator.__(i18nKey);
		}
		super(message);
		Object.setPrototypeOf(this, LocaleError.prototype);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/**
	 * Creates a new LocaleError instance with a custom i18n instance
	 * @param i18nKey The key to look up in the localization files
	 * @param i18nInstance The i18n instance to use for localization
	 * @returns A new LocaleError instance
	 */
	static withCustomI18n(i18nKey: string, i18nInstance: I18n): LocaleError {
		return new LocaleError(i18nKey, undefined, i18nInstance);
	}

	/**
	 * Creates a new LocaleError instance with replacement arguments and a custom i18n instance
	 * @param i18nKey The key to look up in the localization files
	 * @param i18nArgs Replacement arguments for the localized message
	 * @param i18nInstance The i18n instance to use for localization
	 * @returns A new LocaleError instance
	 */
	static withArgsAndCustomI18n(
		i18nKey: string,
		i18nArgs: Replacements,
		i18nInstance: I18n
	): LocaleError {
		return new LocaleError(i18nKey, i18nArgs, i18nInstance);
	}
}
