import { Client, Events, REST, Routes } from 'discord.js';
import { CommandList } from '../model/SimpleDiscordModels.js';
import { LocaleError } from '../model/LocaleError.js';
import { Loggers } from './LoggerManager.js';
import { SimpleDiscordBotConfig } from '../model/SimpleDiscordBotConfig.js';
import i18n from 'i18n';

export class SimpleDiscordBot<T> {
	private _client: Client;
	private _config: SimpleDiscordBotConfig;
	private service: T;

	private register = async (commandList: CommandList<T>) => {
		this._client = new Client({ intents: this._config.intents });

		if (!this._config.discord_token)
			throw new LocaleError('error.discord.no_discord_token');
		if (!this._config.discord_id)
			throw new LocaleError('error.discord.no_discord_id');

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
			if (!interaction) throw new LocaleError('error.discord.no_interaction');
			if (!interaction.guildId)
				throw new LocaleError('error.discord.no_guild_id');
			try {
				let action;
				let extraInfo;
				let payload;
				if (interaction.isAutocomplete()) {
					action = `${interaction.commandName}_autocomplete`;
				} else if (interaction.isStringSelectMenu()) {
					action = interaction.customId;
					extraInfo = interaction.values[0];
				} else if (interaction.isButton()) {
					if (
						interaction.customId === 'prev' ||
						interaction.customId === 'next'
					)
						return;
					const [command, ...infos] = interaction.customId.split(';');
					action = `button_${command}`;
					extraInfo = this.parseKeyValueString(infos);
				} else if (interaction.isModalSubmit()) {
					const [command, ...infos] = interaction.customId.split(';');
					action = `submit_${command}`;
					extraInfo = this.parseKeyValueString(infos);
					payload = interaction.fields;
				} else if (!interaction.isChatInputCommand()) {
					return;
				}
				await commandList.execute(
					interaction,
					this._client,
					this.service,
					action,
					extraInfo,
					payload
				);
			} catch (e: any) {
				Loggers.get().error(e, e.stack);
				if (e.code !== 10062) {
					if ('deferred' in interaction && interaction.deferred) {
						await interaction.editReply({
							content: `⚠️ __${e.message.substring(0, 1_500)}__ ⚠️`,
						});
					} else {
						if ('reply' in interaction)
							await interaction.reply({
								content: `⚠️ __${e.message.substring(0, 1_500)}__ ⚠️`,
								ephemeral: true,
							});
					}
				}
			}
		});
		await this._client.login(this._config.discord_token);
	};

	start = async (commandList: CommandList<T>): Promise<Client> => {
		if (!commandList)
			throw new LocaleError('error.discord.no_configured_command');
		await this.register(commandList);
		return this._client;
	};

	constructor(config: SimpleDiscordBotConfig, service: T) {
		this._config = config;
		this.service = service;

		i18n.configure({
			locales: this._config.available_locale,
			directory: this._config.locale_directory,
			defaultLocale: this._config.available_locale[0],
			objectNotation: true,
		});
		if (
			!this._config.available_locale.includes(this._config.locale.toLowerCase())
		)
			throw new LocaleError('error._default', {
				message: `LOCALE env var not recognized`,
			});
		i18n.setLocale(this._config.locale.toLowerCase());
		Loggers.get().info(`LOCALE : ${this._config.locale.toUpperCase()}`);
	}

	private parseKeyValueString(input: string[]): Record<string, string> {
		return input.reduce(
			(result, pair) => {
				const [key, value] = pair.split(':');
				if (key && value) {
					result[key] = value;
				}
				return result;
			},
			{} as Record<string, string>
		);
	}
}
