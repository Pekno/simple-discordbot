import {
	APIApplicationCommandOptionChoice,
	ApplicationCommandOptionType,
	AutocompleteInteraction,
	BaseInteraction,
	ButtonInteraction,
	CacheType,
	ChatInputCommandInteraction,
	Client,
	CommandInteraction,
	ModalSubmitFields,
	ModalSubmitInteraction,
} from 'discord.js';
import { LocaleError } from './LocaleError';
import { Loggers } from '../services/LoggerManager';

export type AnyCommandInteraction =
	| ChatInputCommandInteraction<CacheType>
	| AutocompleteInteraction<CacheType>
	| ModalSubmitInteraction<CacheType>
	| ButtonInteraction<CacheType>;

/**
 * Manages a collection of Discord commands and their aliases
 */
export class CommandList<T> {
	private _commands: Map<string, Command<T, AnyCommandInteraction>> = new Map();
	private _alias: Map<string, string> = new Map();

	/**
	 * Adds a command to the command list
	 * @param command The command to add
	 * @returns The CommandList instance for chaining
	 */
	push = <C extends AnyCommandInteraction>(
		command: Command<T, C>
	): CommandList<T> => {
		this._commands.set(
			command.name,
			command as Command<T, AnyCommandInteraction>
		);
		if (command.clickAlias) this._alias.set(command.clickAlias, command.name);
		return this;
	};

	/**
	 * Gets a command by name or alias
	 * @param commandName The name or alias of the command
	 * @returns The command, or undefined if not found
	 */
	getCommand = (
		commandName: string
	): Command<T, AnyCommandInteraction> | undefined => {
		// Try to get by name first
		const command = this._commands.get(commandName);
		if (command) return command;

		// If not found, try by alias
		const alias = this._alias.get(commandName);
		return alias ? this._commands.get(alias) : undefined;
	};

	/**
	 * Executes a command based on the interaction and command name
	 * @param interaction The Discord interaction
	 * @param client The Discord client
	 * @param services The service instance
	 * @param commandName Optional command name override
	 * @param extraInfo Optional extra information
	 * @param modalPayload Optional modal payload
	 * @returns Promise that resolves when the command execution is complete
	 * @throws LocaleError if the command name is missing or the command is not found
	 */
	execute = async (
		interaction: BaseInteraction,
		client: Client,
		services: T,
		commandName?: string,
		extraInfo?: any,
		modalPayload?: ModalSubmitFields
	): Promise<void> => {
		// Determine the command name from the interaction or the provided override
		const cmdName =
			commandName ?? (interaction as CommandInteraction).commandName;

		// Validate command name
		if (!cmdName) {
			Loggers.get().error('No command name provided for interaction');
			throw new LocaleError('error.discord.no_command_name');
		}

		// Get the command
		const command = this.getCommand(cmdName);

		// Validate command exists
		if (!command) {
			Loggers.get().error(`Command not found: ${cmdName}`);
			throw new LocaleError('error.discord.command_not_found', {
				command: cmdName,
			});
		}

		// Execute the command
		try {
			// Type assertion needed because we can't guarantee the interaction type matches
			// the command's expected type at compile time, but we validate at runtime
			await command.execute(
				interaction as AnyCommandInteraction,
				client,
				services,
				extraInfo,
				modalPayload
			);
		} catch (error: any) {
			Loggers.get().error(
				`Error executing command ${cmdName}: ${error.message}`
			);
			throw error; // Re-throw to allow the caller to handle it
		}
	};

	/**
	 * Builds an array of command definitions for registration with Discord
	 * @returns Array of command definitions
	 */
	build = (): {
		name: string;
		description: string;
		options: CommandOption[];
	}[] => {
		const res = [];
		for (const [, value] of this._commands) {
			// Only include commands that should be registered
			if (value.registerPredicate()) {
				res.push({
					name: value.name,
					description: value.description,
					options: value.options,
				});
			}
		}
		return res;
	};

	/**
	 * Gets all registered commands
	 * @returns Array of all commands
	 */
	getAllCommands = (): Command<T, AnyCommandInteraction>[] => {
		return Array.from(this._commands.values());
	};
}

/**
 * Base command class for Discord interactions
 */
export class Command<T, C extends AnyCommandInteraction> {
	/** Command name used for slash commands */
	name: string;

	/** Optional alias for button/modal interactions */
	clickAlias: string;

	/** Command description shown in Discord */
	description: string;

	/** Command options/arguments */
	options: CommandOption[];

	/**
	 * Function to execute when the command is triggered
	 * Uses the generic interaction type for better type safety
	 */
	execute: (
		interaction: C,
		client: Client,
		service: T,
		extraInfo?: any,
		modalPayload?: ModalSubmitFields
	) => Promise<void>;

	/**
	 * Function that determines if this command should be registered with Discord
	 * Default is true for regular commands, false for special commands like buttons
	 */
	registerPredicate: () => boolean;

	/**
	 * Creates a new Command instance
	 * @param init Optional partial initialization object
	 */
	public constructor(init?: Partial<Command<T, C>>) {
		// Default values
		this.name = '';
		this.clickAlias = '';
		this.description = '';
		this.options = [];
		this.execute = async () => {}; // Empty default implementation
		this.registerPredicate = () => true;

		// Apply provided values
		if (init) {
			Object.assign(this, init);
		}
	}
}

export class ModalSubmitCommand<T> extends Command<
	T,
	ModalSubmitInteraction<CacheType>
> {
	constructor(init?: Partial<ModalSubmitCommand<T>>) {
		super(init);
		this.registerPredicate = () => false;
	}
}

export class ButtonCommand<T> extends Command<T, ButtonInteraction<CacheType>> {
	constructor(init?: Partial<ButtonCommand<T>>) {
		super(init);
		this.registerPredicate = () => false;
	}
}

export class AutoCompleteCommand<T> extends Command<
	T,
	AutocompleteInteraction<CacheType>
> {
	constructor(init?: Partial<AutoCompleteCommand<T>>) {
		super(init);
		this.registerPredicate = () => false;
	}
}

/**
 * Represents a command option/argument for Discord slash commands
 */
export class CommandOption {
	/** Option name (shown to users in Discord) */
	name: string;

	/** Option description (shown to users in Discord) */
	description: string;

	/** Whether this option supports autocomplete */
	autocomplete: boolean = false;

	/** Whether this option is required */
	required: boolean = false;

	/** The type of option (string, integer, boolean, etc.) */
	type: ApplicationCommandOptionType;

	/** Predefined choices for this option */
	choices: APIApplicationCommandOptionChoice[] = [];

	/**
	 * Creates a new CommandOption instance
	 * @param init Optional partial initialization object
	 */
	public constructor(init?: Partial<CommandOption>) {
		// Default values
		this.name = '';
		this.description = '';
		this.type = ApplicationCommandOptionType.String; // Default to string type

		// Apply provided values
		if (init) {
			Object.assign(this, init);
		}
	}

	/**
	 * Creates a string option
	 * @param name Option name
	 * @param description Option description
	 * @param required Whether the option is required
	 * @param autocomplete Whether the option supports autocomplete
	 * @param choices Predefined choices
	 * @returns A new CommandOption instance
	 */
	static string(
		name: string,
		description: string,
		required: boolean = false,
		autocomplete: boolean = false,
		choices: APIApplicationCommandOptionChoice[] = []
	): CommandOption {
		return new CommandOption({
			name,
			description,
			type: ApplicationCommandOptionType.String,
			required,
			autocomplete,
			choices,
		});
	}

	/**
	 * Creates an integer option
	 * @param name Option name
	 * @param description Option description
	 * @param required Whether the option is required
	 * @param choices Predefined choices
	 * @returns A new CommandOption instance
	 */
	static integer(
		name: string,
		description: string,
		required: boolean = false,
		choices: APIApplicationCommandOptionChoice[] = []
	): CommandOption {
		return new CommandOption({
			name,
			description,
			type: ApplicationCommandOptionType.Integer,
			required,
			choices,
		});
	}

	/**
	 * Creates a boolean option
	 * @param name Option name
	 * @param description Option description
	 * @param required Whether the option is required
	 * @returns A new CommandOption instance
	 */
	static boolean(
		name: string,
		description: string,
		required: boolean = false
	): CommandOption {
		return new CommandOption({
			name,
			description,
			type: ApplicationCommandOptionType.Boolean,
			required,
		});
	}
}
