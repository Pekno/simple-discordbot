import { GatewayIntentBits } from 'discord.js';

/**
 * Configuration interface for the SimpleDiscordBot
 * Contains all the necessary settings to initialize and run the bot
 */
export interface SimpleDiscordBotConfig {
	/**
	 * Discord bot token used for authentication
	 * Can be obtained from the Discord Developer Portal
	 */
	discord_token?: string;

	/**
	 * Discord application ID
	 * Can be obtained from the Discord Developer Portal
	 */
	discord_id?: string;

	/**
	 * Array of Discord gateway intents required by the bot
	 * Determines what events the bot will receive from Discord
	 */
	intents: GatewayIntentBits[];

	/**
	 * Current locale for the bot's responses
	 * Should be one of the locales specified in available_locale
	 */
	locale: string;

	/**
	 * List of available locales supported by the bot
	 * Used for validation and fallback
	 */
	available_locale: string[];

	/**
	 * Path to the directory containing locale files
	 * Used by i18n for localization
	 */
	locale_directory: string;
}
