import { Client, Events, REST, Routes } from 'discord.js';
import { CommandList } from '../model/SimpleDiscordModels.js';
import { LocaleError } from '../model/LocaleError.js';
import { Loggers } from './LoggerManager.js';
import { SimpleDiscordBotConfig } from '../model/SimpleDiscordBotConfig.js';
import { I18n } from 'i18n';

/**
 * Main Discord bot class that wraps Discord.js functionality
 * Handles command registration, interaction processing, and localization
 * @template T Type of the service to be injected into commands
 */
export class SimpleDiscordBot<T> {
	/** Discord.js client instance */
	private _client: Client;

	/** Bot configuration */
	private _config: SimpleDiscordBotConfig;

	/** Service instance to be injected into commands */
	private service: T;

	/** Namespaced i18n instance to avoid conflicts with consuming applications */
	private i18nInstance: I18n;

	/**
	 * Registers slash commands with Discord and sets up event handlers
	 * @param commandList The list of commands to register
	 * @private
	 */
	private register = async (commandList: CommandList<T>) => {
		this._client = new Client({ intents: this._config.intents });

		if (!this._config.discord_token)
			throw LocaleError.withCustomI18n(
				'error.discord.no_discord_token',
				this.i18nInstance
			);
		if (!this._config.discord_id)
			throw LocaleError.withCustomI18n(
				'error.discord.no_discord_id',
				this.i18nInstance
			);

		const rest = new REST({ version: '10' }).setToken(
			this._config.discord_token
		);
		try {
			await rest.put(Routes.applicationCommands(this._config.discord_id), {
				body: commandList.build(),
			});
			Loggers.get().info('Bot : Successfully loaded application (/) commands.');
		} catch (e: any) {
			Loggers.get().error(e, e.stack);
		}

		this._client.on(Events.InteractionCreate, async (interaction) => {
			if (!interaction)
				throw LocaleError.withCustomI18n(
					'error.discord.no_interaction',
					this.i18nInstance
				);
			if (!interaction.guildId)
				throw LocaleError.withCustomI18n(
					'error.discord.no_guild_id',
					this.i18nInstance
				);

			try {
				await this.handleInteraction(interaction, commandList);
			} catch (e: any) {
				Loggers.get().error(e, e.stack);
				await this.handleInteractionError(interaction, e);
			}
		});
		await this._client.login(this._config.discord_token);
	};

	/**
	 * Starts the Discord bot, registering commands and logging in
	 * @param commandList The list of commands to register and use
	 * @returns Promise resolving to the Discord.js Client instance
	 */
	start = async (commandList: CommandList<T>): Promise<Client> => {
		if (!commandList)
			throw LocaleError.withCustomI18n(
				'error.discord.no_configured_command',
				this.i18nInstance
			);
		await this.register(commandList);
		return this._client;
	};

	/**
	 * Creates a new SimpleDiscordBot instance
	 * @param config Configuration options for the bot
	 * @param service Service instance to be injected into commands
	 */
	constructor(config: SimpleDiscordBotConfig, service: T) {
		this._config = config;
		this.service = service;

		// Create a namespaced i18n instance to avoid conflicts with consuming applications
		this.i18nInstance = new I18n();
		this.i18nInstance.configure({
			locales: this._config.available_locale,
			directory: this._config.locale_directory,
			defaultLocale: this._config.available_locale[0],
			objectNotation: true,
		});
		if (
			!this._config.available_locale.includes(this._config.locale.toLowerCase())
		)
			throw LocaleError.withArgsAndCustomI18n(
				'error._default',
				{
					message: `LOCALE env var not recognized`,
				},
				this.i18nInstance
			);
		this.i18nInstance.setLocale(this._config.locale.toLowerCase());
		Loggers.get().info(`LOCALE : ${this._config.locale.toUpperCase()}`);
	}

	/**
	 * Handles an interaction by determining its type and processing it accordingly
	 * @param interaction The Discord interaction to handle
	 * @param commandList The command list to use for execution
	 */
	private async handleInteraction(
		interaction: any,
		commandList: CommandList<T>
	): Promise<void> {
		// Skip processing if it's a navigation button
		if (
			interaction.isButton() &&
			(interaction.customId === 'prev' || interaction.customId === 'next')
		) {
			return;
		}

		// Extract action, extraInfo, and modalPayload based on interaction type
		const { action, extraInfo, modalPayload } =
			this.extractInteractionData(interaction);

		// If we couldn't determine an action and it's not a chat input command, skip
		if (!action && !interaction.isChatInputCommand()) {
			return;
		}

		// Execute the command
		await commandList.execute(
			interaction,
			this._client,
			this.service,
			action,
			extraInfo,
			modalPayload
		);
	}

	/**
	 * Extracts action, extraInfo, and modalPayload from an interaction based on its type
	 * @param interaction The Discord interaction
	 * @returns Object containing action, extraInfo, and modalPayload
	 */
	private extractInteractionData(interaction: any): {
		action?: string;
		extraInfo?: any;
		modalPayload?: any;
	} {
		if (interaction.isAutocomplete()) {
			return {
				action: `${interaction.commandName}_autocomplete`,
			};
		} else if (interaction.isStringSelectMenu()) {
			return {
				action: interaction.customId,
				extraInfo: interaction.values[0],
			};
		} else if (interaction.isButton()) {
			const [command, ...infos] = interaction.customId.split(';');
			return {
				action: `button_${command}`,
				extraInfo: this.parseKeyValueString(infos),
			};
		} else if (interaction.isModalSubmit()) {
			const [command, ...infos] = interaction.customId.split(';');
			return {
				action: `submit_${command}`,
				extraInfo: this.parseKeyValueString(infos),
				modalPayload: interaction.fields,
			};
		}

		// Default case
		return {};
	}

	/**
	 * Handles errors that occur during interaction processing
	 * @param interaction The Discord interaction
	 * @param error The error that occurred
	 */
	private async handleInteractionError(
		interaction: any,
		error: any
	): Promise<void> {
		// Skip handling for unknown interaction errors (Discord code 10062)
		if (error.code === 10062) {
			return;
		}

		const errorMessage = `⚠️ __${error.message.substring(0, 1_500)}__ ⚠️`;

		// Handle based on interaction state
		if ('deferred' in interaction && interaction.deferred) {
			await interaction.editReply({ content: errorMessage });
		} else if ('reply' in interaction) {
			await interaction.reply({
				content: errorMessage,
				ephemeral: true,
			});
		}
	}

	/**
	 * Parses a key-value string array into an object
	 * @param input Array of strings in format "key:=value"
	 * @returns Object with key-value pairs
	 */
	private parseKeyValueString(input: string[]): Record<string, string> {
		return input.reduce(
			(result, pair) => {
				const [key, value] = pair.split(':=');
				if (key && value) {
					result[key] = value;
				}
				return result;
			},
			{} as Record<string, string>
		);
	}
}
