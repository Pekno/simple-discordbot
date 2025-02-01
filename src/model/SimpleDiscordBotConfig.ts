import { GatewayIntentBits } from 'discord.js';

export interface SimpleDiscordBotConfig {
	discord_token?: string;
	discord_id?: string;
	intents: GatewayIntentBits[];
	locale: string;
	available_locale: string[];
	locale_directory: string;
}
